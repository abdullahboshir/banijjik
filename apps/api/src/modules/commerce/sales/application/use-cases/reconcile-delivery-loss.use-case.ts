import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  type CurrencyCode,
} from "@banijjik/contracts";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import type { Money } from "@banijjik/contracts/catalog";
import { STOCK_SOURCE_TYPE } from "@banijjik/contracts/inventory";
import {
  ORDER_STATUS,
  SALES_EVENT_TYPE,
} from "@banijjik/contracts/sales";
import type {
  DeliveryLossClosureResponse,
  ReconcileDeliveryLossRequest,
} from "@banijjik/contracts/sales/delivery";
import {
  asId,
  newId,
  type DeliveryLossClosureId,
  type OrderId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import {
  deliveryLossAlreadyClosed,
  deliveryLossMismatch,
  invalidTransition,
  recordNotFound,
} from "../../domain/errors.js";
import {
  DeliveryLossClosure,
  type DeliveryLossClosureLine,
} from "../../domain/delivery-loss.entity.js";
import type { Order } from "../../domain/order.entity.js";
import type { SalesDependencies } from "../sales-dependencies.js";
import {
  assertLocationAllowed,
  orderOrderingKey,
  stockInputOf,
} from "../sales-transition-shared.js";
import { toDeliveryLossClosureResponse } from "../sales-views.js";

export interface ReconcileDeliveryLossInput {
  readonly organizationId: OrganizationId;
  readonly allowedLocationIds: readonly string[] | "ALL";
  readonly actorUserId: UserId;
  readonly orderId: OrderId;
  readonly body: ReconcileDeliveryLossRequest;
}

export class ReconcileDeliveryLossUseCase {
  constructor(private readonly dependencies: SalesDependencies) {}

  async execute(input: ReconcileDeliveryLossInput): Promise<DeliveryLossClosureResponse> {
    const order = await this.loadAndValidateOrder(input);
    const existing = await this.dependencies.deliveryLosses.findClosureByOrderId(
      input.organizationId,
      input.orderId,
    );
    if (existing) throw deliveryLossAlreadyClosed();

    const lines = this.reconcileLines(order, input.body.lines);
    const totalLostCost = this.calculateTotalLostCost(lines, order.totals.grandTotal.currency);

    const closure = await this.commitLossClosure({
      input,
      order,
      lines,
      totalLostCost,
    });

    return toDeliveryLossClosureResponse(closure);
  }

  private async loadAndValidateOrder(input: ReconcileDeliveryLossInput): Promise<Order> {
    const order = await this.dependencies.orders.findById(input.orderId);
    if (!order) throw recordNotFound();
    assertLocationAllowed(order.locationId, input.allowedLocationIds);
    if (order.status !== ORDER_STATUS.DELIVERY_FAILED) {
      throw invalidTransition(order.status);
    }
    return order;
  }

  private reconcileLines(
    order: Order,
    inputLines: ReconcileDeliveryLossRequest["lines"],
  ): readonly DeliveryLossClosureLine[] {
    const inputMap = new Map(inputLines.map((l) => [l.orderLineId, l]));
    if (inputMap.size !== order.lines.length) {
      throw deliveryLossMismatch("sales.delivery_loss_lines_mismatch");
    }

    let totalLost = 0;
    const reconciled: DeliveryLossClosureLine[] = [];

    for (const orderLine of order.lines) {
      const inputLine = inputMap.get(orderLine.orderLineId);
      if (!inputLine) throw deliveryLossMismatch("sales.delivery_loss_line_missing");
      const line = this.reconcileSingleLine(orderLine, inputLine, order.totals.grandTotal.currency);
      totalLost += line.lostQuantity;
      reconciled.push(line);
    }

    if (totalLost <= 0) throw deliveryLossMismatch("sales.delivery_loss_zero_lost_units");
    return reconciled;
  }

  private reconcileSingleLine(
    orderLine: Order["lines"][number],
    inputLine: ReconcileDeliveryLossRequest["lines"][number],
    orderCurrency: CurrencyCode,
  ): DeliveryLossClosureLine {
    const sum = inputLine.restockQuantity + inputLine.damagedQuantity + inputLine.lostQuantity;
    if (sum !== orderLine.quantity) {
      throw deliveryLossMismatch("sales.delivery_loss_line_quantity_mismatch");
    }
    const unitCost = orderLine.unitCostSnapshot?.amount ?? 0;
    const currency = orderLine.unitCostSnapshot?.currency ?? orderCurrency;
    return {
      orderLineId: orderLine.orderLineId,
      offeringId: orderLine.offeringId,
      variantId: orderLine.variantId,
      inventoryItemId: orderLine.costComponents?.[0]?.inventoryItemId ?? null,
      shippedQuantity: orderLine.quantity,
      restockQuantity: inputLine.restockQuantity,
      damagedQuantity: inputLine.damagedQuantity,
      lostQuantity: inputLine.lostQuantity,
      recoveredQuantity: 0,
      lostCostAmount: unitCost * inputLine.lostQuantity,
      costCurrency: currency,
    };
  }

  private calculateTotalLostCost(
    lines: readonly DeliveryLossClosureLine[],
    currency: CurrencyCode,
  ): Money {
    const amount = lines.reduce((sum, line) => sum + line.lostCostAmount, 0);
    return { amount, currency };
  }

  private buildClosure(ctx: {
    readonly input: ReconcileDeliveryLossInput;
    readonly order: Order;
    readonly lines: readonly DeliveryLossClosureLine[];
    readonly totalLostCost: Money;
    readonly approverMemberId: string;
    readonly now: Date;
  }): DeliveryLossClosure {
    const { input, order, lines, totalLostCost, approverMemberId, now } = ctx;
    return new DeliveryLossClosure({
      deliveryLossClosureId: asId<DeliveryLossClosureId>(newId()),
      organizationId: input.organizationId,
      orderId: order.orderId,
      locationId: order.locationId,
      firstShipmentEventId: order.firstShipment?.shipmentEventId ?? null,
      reasonKey: input.body.reasonKey,
      evidenceFileIds: input.body.evidenceFileIds ?? [],
      lines,
      totalLostCost,
      approvalToken: input.body.approvalToken,
      approvalSnapshot: {
        approverMemberId,
        action: APPROVAL_ACTION.DELIVERY_LOSS_CLOSE,
      },
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }

  private async commitLossClosure(ctx: {
    readonly input: ReconcileDeliveryLossInput;
    readonly order: Order;
    readonly lines: readonly DeliveryLossClosureLine[];
    readonly totalLostCost: Money;
  }): Promise<DeliveryLossClosure> {
    const { input, order, lines, totalLostCost } = ctx;
    const now = this.dependencies.clock.now();
    const settings = await this.dependencies.settings.read(input.organizationId);

    return this.dependencies.unitOfWork.run(async () => {
      const approval = await this.dependencies.approvals.consume(input.body.approvalToken, {
        action: APPROVAL_ACTION.DELIVERY_LOSS_CLOSE,
        subjectKey: input.orderId,
        amount: totalLostCost,
      });

      await this.restockReceivedUnits({
        order,
        lines,
        input,
        allowNegativeStock: settings.allowNegativeStock,
      });

      await this.dependencies.payments.settleCancellation({
        organizationId: input.organizationId,
        orderId: order.orderId,
        contactId: order.contactId,
        locationId: order.locationId,
        actorUserId: input.actorUserId,
        now,
      });

      const closure = this.buildClosure({
        input,
        order,
        lines,
        totalLostCost,
        approverMemberId: approval.approverMemberId,
        now,
      });

      const persistedClosure = await this.dependencies.deliveryLosses.createClosure(closure);
      const updatedOrder = order.reconcileDeliveryLoss({ actorUserId: input.actorUserId, now });
      await this.dependencies.orders.update(updatedOrder, input.body.expectedVersion);

      await this.dependencies.events.publish(
        SALES_EVENT_TYPE.ORDER_DELIVERY_LOSS_CLOSED,
        { orderId: order.orderId },
        { orderingKey: orderOrderingKey(order.orderId) },
      );

      await this.dependencies.audit.record({
        action: AUDIT_ACTION.ORDER_DELIVERY_LOSS_CLOSED,
        entityType: AUDIT_ENTITY_TYPE.order,
        entityId: order.orderId,
        changes: {
          status: { to: ORDER_STATUS.DELIVERY_LOSS_CLOSED },
          deliveryLossClosureId: { to: persistedClosure.deliveryLossClosureId },
        },
      });

      return persistedClosure;
    });
  }

  private async restockReceivedUnits(ctx: {
    readonly order: Order;
    readonly lines: readonly DeliveryLossClosureLine[];
    readonly input: ReconcileDeliveryLossInput;
    readonly allowNegativeStock: boolean;
  }): Promise<void> {
    const { order, lines, input, allowNegativeStock } = ctx;
    if (!order.hasStockLines) return;

    for (const disposition of ["RETURN", "RETURN_DAMAGED"] as const) {
      const restockLines: { offeringId: string; variantId: string; quantity: number }[] = [];
      for (const l of lines) {
        const qty = disposition === "RETURN" ? l.restockQuantity : l.damagedQuantity;
        if (qty <= 0) continue;
        const matching = order.lines.find((ol) => ol.orderLineId === l.orderLineId);
        if (matching) {
          restockLines.push({
            offeringId: matching.offeringId,
            variantId: matching.variantId,
            quantity: qty,
          });
        }
      }

      if (restockLines.length === 0) continue;

      await this.dependencies.stock.returnStock({
        ...stockInputOf({
          organizationId: input.organizationId,
          locationId: order.locationId,
          actorUserId: input.actorUserId,
          orderId: order.orderId,
          lines: restockLines,
          allowNegativeStock,
        }),
        actorUserId: input.actorUserId,
        disposition,
        costFrom: {
          sourceType: STOCK_SOURCE_TYPE.ORDER,
          sourceId: order.orderId,
        },
      });
    }
  }
}

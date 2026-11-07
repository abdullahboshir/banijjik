import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  type CurrencyCode,
} from "@banijjik/contracts";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import type { Money } from "@banijjik/contracts/catalog";
import { STOCK_SOURCE_TYPE } from "@banijjik/contracts/inventory";
import { SALES_EVENT_TYPE } from "@banijjik/contracts/sales";
import type {
  DeliveryLossRecoveryResponse,
  RecoverDeliveryLossRequest,
} from "@banijjik/contracts/sales/delivery";
import {
  asId,
  newId,
  type DeliveryLossRecoveryId,
  type OrderId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import {
  DeliveryLossClosure,
  DeliveryLossRecovery,
  type DeliveryLossRecoveryLine,
} from "../../domain/delivery-loss.entity.js";
import { deliveryLossMismatch, recordNotFound } from "../../domain/errors.js";
import type { Order } from "../../domain/order.entity.js";
import type { SalesDependencies } from "../sales-dependencies.js";
import {
  assertLocationAllowed,
  orderOrderingKey,
  stockInputOf,
} from "../sales-transition-shared.js";
import { toDeliveryLossRecoveryResponse } from "../sales-views.js";

export interface RecoverDeliveryLossInput {
  readonly organizationId: OrganizationId;
  readonly allowedLocationIds: readonly string[] | "ALL";
  readonly actorUserId: UserId;
  readonly orderId: OrderId;
  readonly body: RecoverDeliveryLossRequest;
}

export class RecoverDeliveryLossUseCase {
  constructor(private readonly dependencies: SalesDependencies) {}

  async execute(input: RecoverDeliveryLossInput): Promise<DeliveryLossRecoveryResponse> {
    const { closure, order } = await this.loadClosureAndOrder(input);
    const { recoveryLines, increments, totalRecoveredCost } = this.validateRecoveryLines(
      closure,
      order,
      input.body.lines,
    );

    const recovery = await this.commitRecovery({
      input,
      closure,
      order,
      recoveryLines,
      increments,
      totalRecoveredCost,
    });

    return toDeliveryLossRecoveryResponse(recovery);
  }

  private async loadClosureAndOrder(
    input: RecoverDeliveryLossInput,
  ): Promise<{ closure: DeliveryLossClosure; order: Order }> {
    const closure = await this.dependencies.deliveryLosses.findClosureByOrderId(
      input.organizationId,
      input.orderId,
    );
    if (!closure) throw recordNotFound();
    assertLocationAllowed(closure.locationId, input.allowedLocationIds);

    const order = await this.dependencies.orders.findById(input.orderId);
    if (!order) throw recordNotFound();

    return { closure, order };
  }

  private validateRecoveryLines(
    closure: DeliveryLossClosure,
    order: Order,
    inputLines: RecoverDeliveryLossRequest["lines"],
  ): {
    readonly recoveryLines: readonly DeliveryLossRecoveryLine[];
    readonly increments: ReadonlyMap<string, number>;
    readonly totalRecoveredCost: Money;
  } {
    const closureLineMap = new Map(closure.lines.map((l) => [l.orderLineId, l]));
    const increments = new Map<string, number>();
    const recoveryLines: DeliveryLossRecoveryLine[] = [];
    let totalCostAmount = 0;

    for (const inLine of inputLines) {
      const cLine = closureLineMap.get(inLine.orderLineId);
      if (!cLine) throw deliveryLossMismatch("sales.recovery_line_not_in_closure");

      const qty = inLine.restockQuantity + inLine.damagedQuantity;
      if (qty <= 0) continue;

      const unrecovered = cLine.lostQuantity - cLine.recoveredQuantity;
      if (qty > unrecovered) throw deliveryLossMismatch("sales.recovery_exceeds_lost_quantity");

      increments.set(inLine.orderLineId, (increments.get(inLine.orderLineId) ?? 0) + qty);

      const orderLine = order.lines.find((ol) => ol.orderLineId === inLine.orderLineId);
      const unitCost = orderLine?.unitCostSnapshot?.amount ?? 0;
      const cost = unitCost * qty;
      totalCostAmount += cost;

      recoveryLines.push({
        orderLineId: inLine.orderLineId,
        offeringId: cLine.offeringId,
        variantId: cLine.variantId,
        inventoryItemId: cLine.inventoryItemId,
        restockQuantity: inLine.restockQuantity,
        damagedQuantity: inLine.damagedQuantity,
        recoveredCostAmount: cost,
        costCurrency: cLine.costCurrency,
      });
    }

    if (recoveryLines.length === 0) throw deliveryLossMismatch("sales.recovery_no_units");
    const currency = closure.totalLostCost.currency;
    return {
      recoveryLines,
      increments,
      totalRecoveredCost: { amount: totalCostAmount, currency: currency as CurrencyCode },
    };
  }

  private buildRecovery(ctx: {
    readonly input: RecoverDeliveryLossInput;
    readonly closure: DeliveryLossClosure;
    readonly order: Order;
    readonly recoveryLines: readonly DeliveryLossRecoveryLine[];
    readonly totalRecoveredCost: Money;
    readonly approverMemberId: string;
    readonly now: Date;
  }): DeliveryLossRecovery {
    const { input, closure, order, recoveryLines, totalRecoveredCost, approverMemberId, now } = ctx;
    return new DeliveryLossRecovery({
      deliveryLossRecoveryId: asId<DeliveryLossRecoveryId>(newId()),
      organizationId: input.organizationId,
      deliveryLossClosureId: closure.deliveryLossClosureId,
      orderId: order.orderId,
      locationId: order.locationId,
      lines: recoveryLines,
      totalRecoveredCost,
      approvalToken: input.body.approvalToken,
      approvalSnapshot: {
        approverMemberId,
        action: APPROVAL_ACTION.DELIVERY_LOSS_RECOVER,
      },
      createdAt: now,
      createdByUserId: input.actorUserId,
    });
  }

  private async commitRecovery(ctx: {
    readonly input: RecoverDeliveryLossInput;
    readonly closure: DeliveryLossClosure;
    readonly order: Order;
    readonly recoveryLines: readonly DeliveryLossRecoveryLine[];
    readonly increments: ReadonlyMap<string, number>;
    readonly totalRecoveredCost: Money;
  }): Promise<DeliveryLossRecovery> {
    const { input, closure, order, recoveryLines, increments, totalRecoveredCost } = ctx;
    const now = this.dependencies.clock.now();
    const settings = await this.dependencies.settings.read(input.organizationId);

    return this.dependencies.unitOfWork.run(async () => {
      const approval = await this.dependencies.approvals.consume(input.body.approvalToken, {
        action: APPROVAL_ACTION.DELIVERY_LOSS_RECOVER,
        subjectKey: closure.deliveryLossClosureId,
        amount: totalRecoveredCost,
      });

      await this.restockPhysicalGoods({
        order,
        lines: recoveryLines,
        input,
        allowNegativeStock: settings.allowNegativeStock,
      });

      const updatedClosure = closure.withRecoveredQuantities(increments, {
        actorUserId: input.actorUserId,
        now,
      });
      await this.dependencies.deliveryLosses.updateClosure(
        updatedClosure,
        input.body.expectedVersion,
      );

      const recovery = this.buildRecovery({
        input,
        closure,
        order,
        recoveryLines,
        totalRecoveredCost,
        approverMemberId: approval.approverMemberId,
        now,
      });

      const persistedRecovery = await this.dependencies.deliveryLosses.createRecovery(recovery);
      await this.recordRecoverySideEffects(persistedRecovery, order.orderId);
      return persistedRecovery;
    });
  }

  private async recordRecoverySideEffects(
    recovery: DeliveryLossRecovery,
    orderId: OrderId,
  ): Promise<void> {
    await this.dependencies.events.publish(
      SALES_EVENT_TYPE.DELIVERY_LOSS_RECOVERED,
      {
        deliveryLossRecoveryId: recovery.deliveryLossRecoveryId,
        deliveryLossClosureId: recovery.deliveryLossClosureId,
        orderId,
      },
      { orderingKey: orderOrderingKey(orderId) },
    );

    await this.dependencies.audit.record({
      action: AUDIT_ACTION.DELIVERY_LOSS_RECOVERED,
      entityType: AUDIT_ENTITY_TYPE.deliveryLossRecovery,
      entityId: recovery.deliveryLossRecoveryId,
      changes: {
        deliveryLossClosureId: { to: recovery.deliveryLossClosureId },
        orderId: { to: orderId },
      },
    });
  }

  private async restockPhysicalGoods(ctx: {
    readonly order: Order;
    readonly lines: readonly DeliveryLossRecoveryLine[];
    readonly input: RecoverDeliveryLossInput;
    readonly allowNegativeStock: boolean;
  }): Promise<void> {
    const { order, lines, input, allowNegativeStock } = ctx;
    for (const disposition of ["RETURN", "RETURN_DAMAGED"] as const) {
      const targetLines: { offeringId: string; variantId: string; quantity: number }[] = [];
      for (const l of lines) {
        const qty = disposition === "RETURN" ? l.restockQuantity : l.damagedQuantity;
        if (qty <= 0) continue;
        const matching = order.lines.find((ol) => ol.orderLineId === l.orderLineId);
        if (matching) {
          targetLines.push({
            offeringId: matching.offeringId,
            variantId: matching.variantId,
            quantity: qty,
          });
        }
      }

      if (targetLines.length === 0) continue;

      await this.dependencies.stock.returnStock({
        ...stockInputOf({
          organizationId: input.organizationId,
          locationId: order.locationId,
          actorUserId: input.actorUserId,
          orderId: order.orderId,
          lines: targetLines,
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

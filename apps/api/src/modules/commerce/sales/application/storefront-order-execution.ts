import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  LIMIT_KEY,
  SEQUENCE_KEY,
} from "@banijjik/contracts";
import { ORDER_SOURCE, SALES_ADVANCE_REQUIRED, SALES_EVENT_TYPE } from "@banijjik/contracts/sales";
import type {
  ContactId,
  LocationId,
  OrderId,
  OrganizationId,
} from "@banijjik/ids";
import { nextSequenceValue } from "../../../../kernel/sequence/index.js";
import { businessMonthKeyOf } from "../domain/business-date.js";
import type { Order } from "../domain/order.entity.js";
import type { SalesDependencies } from "./sales-dependencies.js";
import {
  formatOrderNumber,
  orderOrderingKey,
  stockInputOf,
} from "./sales-transition-shared.js";
import type { PreparedLines } from "./sales-line-preparation.js";

export interface PlaceExecutionParams {
  readonly dependencies: SalesDependencies;
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly contactId: ContactId;
  readonly draft: Order;
  readonly prepared: PreparedLines;
  readonly now: Date;
  readonly timeZone: string;
}

interface ReserveStockParams {
  readonly dependencies: SalesDependencies;
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly orderId: OrderId;
  readonly lines: PreparedLines["trackedLines"];
  readonly allowNegativeStock: boolean;
}

async function reserveStock(params: ReserveStockParams): Promise<void> {
  if (params.lines.length === 0) return;
  await params.dependencies.stock.reserve(
    stockInputOf({
      organizationId: params.organizationId,
      locationId: params.locationId,
      actorUserId: null,
      orderId: params.orderId,
      lines: params.lines,
      allowNegativeStock: params.allowNegativeStock,
    }),
  );
}

async function handleAutoConfirmation(
  dependencies: SalesDependencies,
  transitioned: Order,
  now: Date,
): Promise<Order> {
  const confirmed = transitioned.confirm({ actorUserId: null, now });
  await dependencies.orders.update(confirmed, transitioned.version);
  await dependencies.events.publish(
    SALES_EVENT_TYPE.ORDER_CONFIRMED,
    { orderId: confirmed.orderId },
    { orderingKey: orderOrderingKey(confirmed.orderId) },
  );
  await dependencies.audit.record({
    action: AUDIT_ACTION.ORDER_CONFIRMED,
    entityType: AUDIT_ENTITY_TYPE.order,
    entityId: confirmed.orderId,
    changes: {},
  });
  return confirmed;
}

async function publishOrderPlaced(
  dependencies: SalesDependencies,
  order: Order,
): Promise<void> {
  await dependencies.events.publish(
    SALES_EVENT_TYPE.ORDER_PLACED,
    { orderId: order.orderId },
    { orderingKey: orderOrderingKey(order.orderId) },
  );
  await dependencies.audit.record({
    action: AUDIT_ACTION.ORDER_PLACED,
    entityType: AUDIT_ENTITY_TYPE.order,
    entityId: order.orderId,
    changes: {
      orderNumber: { to: order.orderNumber },
      status: { to: order.status },
      source: { to: ORDER_SOURCE.STOREFRONT },
    },
  });
}

export async function executePlaceTransaction(params: PlaceExecutionParams): Promise<Order> {
  const { dependencies, organizationId, locationId, contactId, draft, prepared, now, timeZone } =
    params;
  const settings = await dependencies.settings.read(organizationId);

  return dependencies.unitOfWork.run(async () => {
    const counted = (await dependencies.counter.increment(businessMonthKeyOf(now, timeZone))) - 1;
    await dependencies.limits.assertBelow(LIMIT_KEY.ORDERS_PER_MONTH, counted);

    const orderNumber = formatOrderNumber(
      await nextSequenceValue({
        organizationId,
        sequenceKey: SEQUENCE_KEY.ORDER,
      }),
    );

    await reserveStock({
      dependencies,
      organizationId,
      locationId,
      orderId: draft.orderId,
      lines: prepared.trackedLines,
      allowNegativeStock: settings.allowNegativeStock,
    });

    const transitioned = draft.place({
      orderNumber,
      contactId,
      lines: prepared.lines,
      totals: prepared.totals,
      approval: null,
      hasStockLines: prepared.trackedLines.length > 0,
      deliveryZoneId: prepared.deliveryZoneId,
      actor: { actorUserId: null, now },
    });

    await dependencies.orders.insert(transitioned);

    await dependencies.payments.initializeSummary({
      organizationId,
      orderId: transitioned.orderId,
      contactId: transitioned.contactId,
      locationId: transitioned.locationId,
      total: transitioned.totals.grandTotal,
      now,
    });

    await publishOrderPlaced(dependencies, transitioned);

    if (settings.autoConfirm && settings.advanceRequired === SALES_ADVANCE_REQUIRED.NONE) {
      return handleAutoConfirmation(dependencies, transitioned, now);
    }

    return transitioned;
  });
}

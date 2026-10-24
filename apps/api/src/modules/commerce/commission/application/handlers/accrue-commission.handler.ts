import { EVENT_TYPE, MODULE_KEY, type EventEnvelope } from "@banijjik/contracts";
import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { EventHandler } from "../../../../../kernel/events/index.js";
import {
  accrueCompletedBooking,
  accrueCompletedOrder,
  accrueSalesReturn,
  reconcilePaymentSources,
  type AccrualDependencies,
  type CommissionEventContext,
} from "../accrue-commission.js";

/** Reads one string field of an event payload without a cast; a payload of another shape is a bug, not a case to skip. */
export function readStringField(payload: unknown, key: string): string {
  if (typeof payload === "object" && payload !== null && key in payload) {
    const value: unknown = Reflect.get(payload, key);
    if (typeof value === "string" && value.length > 0) return value;
  }
  throw new Error(`event payload has no string field "${key}"`);
}

function contextOf(envelope: EventEnvelope<unknown>): CommissionEventContext {
  if (envelope.organizationId === null) {
    throw new Error("a commission event always belongs to an organization");
  }
  return {
    organizationId: asId<OrganizationId>(envelope.organizationId),
    actorUserId: envelope.actorUserId === null ? null : asId<UserId>(envelope.actorUserId),
    occurredAt: new Date(envelope.occurredAt),
  };
}

/**
 * Accrues commission when a booking or an order is completed and reconciles it when a payment is refunded or
 * reversed. UNORDERED on purpose (plan 3.11, Amendment 1): an ORDERED handler that listens to only
 * some types of a stream waits forever, and the reconcile from the payment summary already gives
 * the same ledger whatever order the events arrive in.
 */
export function buildAccrueCommissionHandler(
  dependencies: AccrualDependencies,
): EventHandler<typeof EVENT_TYPE.BOOKING_COMPLETED> {
  return {
    handlerKey: "commission.accrue",
    moduleKey: MODULE_KEY.COMMISSION,
    eventType: EVENT_TYPE.BOOKING_COMPLETED,
    alsoHandles: [
      EVENT_TYPE.ORDER_COMPLETED,
      EVENT_TYPE.SALES_RETURN_CREATED,
      EVENT_TYPE.PAYMENT_REFUNDED,
      EVENT_TYPE.PAYMENT_REVERSED,
    ],
    ordering: "UNORDERED",
    async handle(envelope) {
      const context = contextOf(envelope);
      if (envelope.type === EVENT_TYPE.ORDER_COMPLETED) {
        await accrueCompletedOrder(dependencies, {
          orderId: readStringField(envelope.payload, "orderId"),
          context,
        });
        return;
      }
      if (envelope.type === EVENT_TYPE.SALES_RETURN_CREATED) {
        await accrueSalesReturn(dependencies, {
          orderId: readStringField(envelope.payload, "orderId"),
          context,
        });
        return;
      }
      if (envelope.type === EVENT_TYPE.BOOKING_COMPLETED) {
        await accrueCompletedBooking(dependencies, {
          bookingId: readStringField(envelope.payload, "bookingId"),
          context,
        });
        return;
      }
      await reconcilePaymentSources(dependencies, {
        paymentId: readStringField(envelope.payload, "paymentId"),
        context,
      });
    },
  };
}

import { MODULE_KEY } from "@banijjik/contracts";
import { PAYMENT_EVENT_TYPE } from "@banijjik/contracts/payment";
import type { EventHandler } from "../../../../../kernel/events/index.js";
import type { EnrollmentDependencies } from "../dependencies.js";
import { syncEnrollmentPaymentsForPayment } from "../sync-enrollment-payments.js";

/** Reads one string field of an event payload without a cast; a payload of another shape is a bug, not a case to skip. */
function readStringField(payload: unknown, key: string): string {
  if (typeof payload === "object" && payload !== null && key in payload) {
    const value: unknown = Reflect.get(payload, key);
    if (typeof value === "string" && value.length > 0) return value;
  }
  throw new Error(`event payload has no string field "${key}"`);
}

/**
 * `enrollment.syncPayments` (decision 6): UNORDERED on purpose — the period status is recomputed
 * from the payment summary every time, so any order and a repeat delivery change nothing.
 * A 409 on the period or the enrollment (staff changed it) throws and the event runner retries.
 */
export function buildSyncEnrollmentPaymentsHandler(
  dependencies: EnrollmentDependencies,
): EventHandler<typeof PAYMENT_EVENT_TYPE.PAYMENT_RECEIVED> {
  return {
    handlerKey: "enrollment.syncPayments",
    moduleKey: MODULE_KEY.ENROLLMENT,
    eventType: PAYMENT_EVENT_TYPE.PAYMENT_RECEIVED,
    alsoHandles: [PAYMENT_EVENT_TYPE.PAYMENT_REFUNDED, PAYMENT_EVENT_TYPE.PAYMENT_REVERSED],
    ordering: "UNORDERED",
    async handle(envelope) {
      const organizationId = envelope.organizationId;
      if (organizationId === null) {
        throw new Error("a payment event always belongs to an organization");
      }
      await syncEnrollmentPaymentsForPayment(
        dependencies,
        organizationId,
        readStringField(envelope.payload, "paymentId"),
      );
    },
  };
}

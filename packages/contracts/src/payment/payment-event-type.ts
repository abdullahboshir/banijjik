/**
 * Payment events accounting consumes (card 3.8c). Card 3.8 publishes exactly these; payloads are
 * ids only. Whichever branch merges second rebases (lead clarification for ADR-124).
 */
export const PAYMENT_EVENT_TYPE = Object.freeze({
  PAYMENT_RECEIVED: "payment.payment.received",
  PAYMENT_REFUNDED: "payment.payment.refunded",
  PAYMENT_REVERSED: "payment.payment.reversed",
  STORE_CREDIT_CHANGED: "payment.storeCredit.changed",
} as const);

export type PaymentEventType = (typeof PAYMENT_EVENT_TYPE)[keyof typeof PAYMENT_EVENT_TYPE];

export interface PaymentEventPayload {
  readonly paymentId: string;
}

export interface StoreCreditEventPayload {
  readonly storeCreditEntryId: string;
}

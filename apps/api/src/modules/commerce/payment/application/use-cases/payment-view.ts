import type { PaymentResponse } from "@banijjik/contracts/payment";
import type { Payment } from "../../domain/payment.entity.js";

export function formatPaymentNumber(seq: number): string {
  return `PAY-${String(seq).padStart(5, "0")}`;
}

export function toPaymentResponse(payment: Payment): PaymentResponse {
  const props = payment.toProps();
  return {
    paymentId: props.paymentId,
    paymentNumber: props.paymentNumber,
    locationId: props.locationId,
    direction: props.direction,
    method: props.method,
    amount: props.amount,
    externalReference: props.externalReference,
    reversesPaymentId: props.reversesPaymentId,
    allocations: props.allocations,
    contactId: props.contactId,
    receivedByMemberId: props.receivedByMemberId,
    businessDate: props.businessDate,
    approval: props.approval,
    note: props.note,
    version: props.version,
    createdAt: props.createdAt.toISOString(),
    updatedAt: props.updatedAt.toISOString(),
  };
}

import type {
  SalesReturnListItem,
  SalesReturnPreviewResponse,
  SalesReturnResponse,
} from "@banijjik/contracts/sales";
import type { SalesReturnRecord } from "../domain/sales-return.record.js";
import type { PreparedSalesReturn } from "./sales-return-prepare.js";

export function toSalesReturnResponse(record: SalesReturnRecord): SalesReturnResponse {
  return {
    salesReturnId: record.salesReturnId,
    salesReturnNumber: record.salesReturnNumber,
    orderId: record.orderId,
    locationId: record.locationId,
    contactId: record.contactId,
    lines: record.lines,
    deliveryChargeReturned: record.deliveryChargeReturned,
    roundingReturned: record.roundingReturned,
    value: record.value,
    refund: {
      method: record.refund.method,
      amount: record.refund.amount,
      paymentId: record.refund.paymentId,
      storeCreditEntryId: record.refund.storeCreditEntryId,
    },
    dueReduced: record.dueReduced,
    reasonKey: record.reasonKey,
    note: record.note,
    approvals: record.approvals.map((approval) => ({
      action: approval.action,
      approvalId: approval.approvalId,
      approverMemberId: approval.approverMemberId,
      approvedAt: approval.approvedAt.toISOString(),
    })),
    status: record.status,
    reversal:
      record.reversal === null
        ? null
        : {
            reversedAt: record.reversal.reversedAt.toISOString(),
            reversedByUserId: record.reversal.reversedByUserId,
            reasonKey: record.reversal.reasonKey,
            note: record.reversal.note,
            paybackPaymentId: record.reversal.paybackPaymentId,
            approval: {
              ...record.reversal.approval,
              approvedAt: record.reversal.approval.approvedAt.toISOString(),
            },
          },
    exchangeOrderId: record.exchangeOrderId,
    businessDate: record.businessDate,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toSalesReturnListItem(record: SalesReturnRecord): SalesReturnListItem {
  return {
    salesReturnId: record.salesReturnId,
    salesReturnNumber: record.salesReturnNumber,
    orderId: record.orderId,
    value: record.value,
    refundAmount: record.refund.amount,
    reasonKey: record.reasonKey,
    status: record.status,
    businessDate: record.businessDate,
    createdAt: record.createdAt.toISOString(),
  };
}

/** The preview shows what the create would write, and which approvals it would need (no writes). */
export function toSalesReturnPreview(prepared: PreparedSalesReturn): SalesReturnPreviewResponse {
  const { plan, settlement, currency } = prepared;
  return {
    lines: plan.lines.map((line) => ({
      orderLineId: line.orderLineId,
      nameSnapshot: line.nameSnapshot,
      quantity: line.quantity,
      disposition: line.disposition,
      value: line.value,
      taxPart: line.taxPart,
    })),
    deliveryChargeReturned: plan.deliveryChargeReturned,
    roundingReturned: plan.roundingReturned,
    value: plan.value,
    dueReduced: { amount: settlement.dueReducedMinor, currency },
    refundAmount: { amount: settlement.refundMinor, currency },
    requiresRefundApproval: prepared.refundApprovalRequired,
    requiresNotReceivedApproval: prepared.notReceivedApprovalRequired,
  };
}

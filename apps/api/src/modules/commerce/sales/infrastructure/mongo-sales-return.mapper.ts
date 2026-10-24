import {
  asId,
  type ContactId,
  type LocationId,
  type OrderId,
  type OrganizationId,
  type SalesReturnId,
  type UserId,
} from "@banijjik/ids";
import type { SalesReturnRecord } from "../domain/sales-return.record.js";
import type { SalesReturnDocument } from "./sales-return.schema.js";

/** Reads a stored return into the domain shape: domain ids and Dates, never Mongo `_id`. */
export function toSalesReturnRecord(document: SalesReturnDocument): SalesReturnRecord {
  return {
    salesReturnId: asId<SalesReturnId>(document.salesReturnId),
    organizationId: asId<OrganizationId>(document.organizationId),
    salesReturnNumber: document.salesReturnNumber,
    orderId: asId<OrderId>(document.orderId),
    locationId: asId<LocationId>(document.locationId),
    contactId: document.contactId === null ? null : asId<ContactId>(document.contactId),
    lines: document.lines.map((line) => ({
      orderLineId: line.orderLineId,
      offeringId: line.offeringId,
      variantId: line.variantId,
      nameSnapshot: line.nameSnapshot,
      quantity: line.quantity,
      disposition: line.disposition,
      value: {
        amount: line.value.amount,
        currency: line.value.currency as SalesReturnRecord["value"]["currency"],
      },
      taxPart: {
        amount: line.taxPart.amount,
        currency: line.taxPart.currency as SalesReturnRecord["value"]["currency"],
      },
    })),
    deliveryChargeReturned: moneyOf(document.deliveryChargeReturned),
    roundingReturned: moneyOf(document.roundingReturned),
    value: moneyOf(document.value),
    refund: {
      method: document.refund.method,
      amount: moneyOf(document.refund.amount),
      paymentId: document.refund.paymentId,
      storeCreditEntryId: document.refund.storeCreditEntryId,
    },
    dueReduced: moneyOf(document.dueReduced),
    reasonKey: document.reasonKey,
    note: document.note,
    approvals: document.approvals.map((approval) => ({
      action: approval.action,
      approvalId: approval.approvalId,
      approverMemberId: approval.approverMemberId,
      approvedAt: approval.approvedAt,
    })),
    status: document.status,
    reversedBySalesReturnId: document.reversedBySalesReturnId,
    exchangeOrderId: document.exchangeOrderId,
    businessDate: document.businessDate,
    version: document.version,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    createdByUserId:
      document.createdByUserId === null ? null : asId<UserId>(document.createdByUserId),
    updatedByUserId:
      document.updatedByUserId === null ? null : asId<UserId>(document.updatedByUserId),
  };
}

function moneyOf(value: { amount: number; currency: string }): SalesReturnRecord["value"] {
  return {
    amount: value.amount,
    currency: value.currency as SalesReturnRecord["value"]["currency"],
  };
}

/** Writes a new return row; the domain record carries every field the schema stores. */
export function toSalesReturnDocument(record: SalesReturnRecord): SalesReturnDocument {
  return {
    salesReturnId: record.salesReturnId,
    organizationId: record.organizationId,
    salesReturnNumber: record.salesReturnNumber,
    orderId: record.orderId,
    locationId: record.locationId,
    contactId: record.contactId,
    lines: record.lines.map((line) => ({
      ...line,
      value: { ...line.value },
      taxPart: { ...line.taxPart },
    })),
    deliveryChargeReturned: { ...record.deliveryChargeReturned },
    roundingReturned: { ...record.roundingReturned },
    value: { ...record.value },
    refund: {
      method: record.refund.method,
      amount: { ...record.refund.amount },
      paymentId: record.refund.paymentId,
      storeCreditEntryId: record.refund.storeCreditEntryId,
    },
    dueReduced: { ...record.dueReduced },
    reasonKey: record.reasonKey,
    note: record.note,
    approvals: record.approvals.map((approval) => ({ ...approval })),
    status: record.status,
    reversedBySalesReturnId: record.reversedBySalesReturnId,
    exchangeOrderId: record.exchangeOrderId,
    businessDate: record.businessDate,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    createdByUserId: record.createdByUserId,
    updatedByUserId: record.updatedByUserId,
  };
}

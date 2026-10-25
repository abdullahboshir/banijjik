import type {
  Money,
  ReturnDisposition,
  SalesReturnReason,
  SalesReturnRefundMethod,
  SalesReturnStatus,
} from "@banijjik/contracts/sales";
import type {
  ContactId,
  LocationId,
  OrderId,
  OrganizationId,
  SalesReturnId,
  UserId,
} from "@banijjik/ids";

export interface SalesReturnLineRecord {
  readonly orderLineId: string;
  readonly offeringId: string;
  readonly variantId: string;
  readonly nameSnapshot: string;
  readonly quantity: number;
  readonly disposition: ReturnDisposition;
  readonly value: Money;
  readonly taxPart: Money;
}

export interface SalesReturnRefundRecord {
  readonly method: SalesReturnRefundMethod | null;
  readonly amount: Money;
  readonly paymentId: string | null;
  readonly storeCreditEntryId: string | null;
}

export interface SalesReturnApprovalRecord {
  readonly action: string;
  readonly approvalId: string;
  readonly approverMemberId: string;
  readonly approvedAt: Date;
}

export interface SalesReturnReversalRecord {
  readonly reversedAt: Date;
  readonly reversedByUserId: UserId;
  readonly reasonKey: string;
  readonly note: string | null;
  readonly paybackPaymentId: string | null;
  readonly approval: SalesReturnApprovalRecord;
}

/** One return of goods from a completed order (plan 3.5b decision 1). Append-only apart from the A2 status change. */
export interface SalesReturnRecord {
  readonly salesReturnId: SalesReturnId;
  readonly organizationId: OrganizationId;
  readonly salesReturnNumber: string;
  readonly orderId: OrderId;
  readonly locationId: LocationId;
  readonly contactId: ContactId | null;
  readonly lines: readonly SalesReturnLineRecord[];
  readonly deliveryChargeReturned: Money;
  readonly roundingReturned: Money;
  readonly value: Money;
  readonly refund: SalesReturnRefundRecord;
  readonly dueReduced: Money;
  readonly reasonKey: SalesReturnReason;
  readonly note: string | null;
  readonly approvals: readonly SalesReturnApprovalRecord[];
  readonly status: SalesReturnStatus;
  readonly reversal: SalesReturnReversalRecord | null;
  readonly exchangeOrderId: string | null;
  readonly businessDate: string;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

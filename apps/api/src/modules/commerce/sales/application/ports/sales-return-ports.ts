import type { SalesReturnId, OrderId, OrganizationId, UserId } from "@banijjik/ids";
import type { SalesReturnRecord } from "../../domain/sales-return.record.js";

export interface SalesReturnListFilter {
  /** The locations the caller reaches, narrowed by the query. */
  readonly locationIds: readonly string[] | "ALL";
  readonly orderId?: OrderId;
  /** Organization-local business dates, `YYYY-MM-DD`. */
  readonly from?: string;
  readonly to?: string;
  readonly page: number;
  readonly limit: number;
}

export interface SalesReturnPage {
  readonly items: readonly SalesReturnRecord[];
  readonly hasNext: boolean;
}

export interface SalesReturnRepository {
  insert(record: SalesReturnRecord): Promise<void>;
  findById(salesReturnId: SalesReturnId): Promise<SalesReturnRecord | undefined>;
  reverse(input: {
    readonly salesReturnId: SalesReturnId;
    readonly expectedVersion: number;
    readonly reversal: NonNullable<SalesReturnRecord["reversal"]>;
  }): Promise<SalesReturnRecord>;
  /** Σ of `deliveryChargeReturned` over the order's ACTIVE returns (plan decision 4). */
  sumActiveDeliveryReturned(organizationId: OrganizationId, orderId: OrderId): Promise<number>;
  list(filter: SalesReturnListFilter): Promise<SalesReturnPage>;
}

/** The refund approval rule of payment: a manager's exemption skips the REFUND token (ADR-121). */
export interface SalesRefundApprovalRule {
  approvalRequired(
    organizationId: OrganizationId,
    hasRefundWithoutApprovalPermission: boolean,
  ): Promise<boolean>;
}

/** Whether the caller may refund without a manager token at a location (payment's permission key). */
export interface SalesRefundPermissionReader {
  hasRefundWithoutApproval(userId: UserId, locationId: string): Promise<boolean>;
}

/** The member id that records the refund and the return as received (payment's `receivedByMemberId`). */
export interface SalesReturnMemberReader {
  memberIdOf(userId: UserId, organizationId: OrganizationId): Promise<string>;
}

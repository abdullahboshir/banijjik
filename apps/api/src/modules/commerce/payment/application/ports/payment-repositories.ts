import type {
  PaymentDirection,
  PaymentMethod,
  PaymentRequestType,
} from "@banijjik/contracts/payment";
import type {
  ContactId,
  LocationId,
  OrganizationId,
  PaymentId,
  StoreCreditEntryId,
} from "@banijjik/ids";
import type { Payment } from "../../domain/payment.entity.js";
import type { PaymentSummary } from "../../domain/payment-summary.entity.js";
import type { StoreCreditEntry } from "../../domain/store-credit-entry.entity.js";

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export interface ListPaymentsFilter {
  readonly organizationId: OrganizationId;
  readonly locationId?: LocationId | undefined;
  readonly contactId?: string | undefined;
  readonly method?: PaymentMethod | undefined;
  readonly direction?: PaymentDirection | undefined;
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly page: number;
  readonly limit: number;
}

export interface ListStoreCreditFilter {
  readonly organizationId: OrganizationId;
  readonly contactId: ContactId;
  readonly page: number;
  readonly limit: number;
}

export interface ListDuesFilter {
  readonly organizationId: OrganizationId;
  readonly locationId?: LocationId | undefined;
  readonly contactId?: string | undefined;
  readonly requestType?: PaymentRequestType | undefined;
  readonly page: number;
  readonly limit: number;
}

export interface PaymentRepository {
  create(payment: Payment): Promise<Payment>;
  findById(organizationId: OrganizationId, paymentId: PaymentId): Promise<Payment | undefined>;
  findByReference(
    organizationId: OrganizationId,
    method: PaymentMethod,
    externalReference: string,
  ): Promise<Payment | undefined>;
  findReversalOf(organizationId: OrganizationId, paymentId: string): Promise<Payment | undefined>;
  list(filter: ListPaymentsFilter): Promise<PaginatedResult<Payment>>;
}

export interface StoreCreditRepository {
  create(entry: StoreCreditEntry): Promise<StoreCreditEntry>;
  findById(
    organizationId: OrganizationId,
    storeCreditEntryId: StoreCreditEntryId,
  ): Promise<StoreCreditEntry | undefined>;
  listByContact(filter: ListStoreCreditFilter): Promise<PaginatedResult<StoreCreditEntry>>;
  listExpiredUnprocessed(
    organizationId: OrganizationId,
    now: Date,
  ): Promise<readonly StoreCreditEntry[]>;
}

export interface PaymentSummaryRepository {
  findByRequest(
    organizationId: OrganizationId,
    requestType: PaymentRequestType,
    requestId: string,
  ): Promise<PaymentSummary | undefined>;
  upsert(summary: PaymentSummary): Promise<void>;
  listDues(filter: ListDuesFilter): Promise<PaginatedResult<PaymentSummary>>;
}

export interface ContactStoreCreditPort {
  getBalance(
    organizationId: OrganizationId,
    contactId: ContactId,
  ): Promise<{ balanceMinor: number; version: number } | undefined>;
  adjustBalance(input: {
    readonly organizationId: OrganizationId;
    readonly contactId: ContactId;
    readonly deltaMinor: number;
    readonly expectedVersion: number;
  }): Promise<{ success: boolean; newBalanceMinor: number }>;
}

export interface PaymentUnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}

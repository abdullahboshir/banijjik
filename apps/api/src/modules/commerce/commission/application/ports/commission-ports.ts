import type { CurrencyCode, OfferingKind } from "@banijjik/contracts";
import type { BookingPriceSnapshot, BookingStatus } from "@banijjik/contracts/booking";
import type {
  CommissionEntryRecordedPayload,
  CommissionPayoutPaidPayload,
  COMMISSION_EVENT_TYPE,
} from "@banijjik/contracts/commission";
import type {
  CommissionRuleStatus,
  CommissionSourceType,
  CommissionSubjectType,
} from "@banijjik/contracts/commission";
import type { PaymentRequestType } from "@banijjik/contracts/payment";
import type { OrderStatus } from "@banijjik/contracts/sales";
import type { Money } from "@banijjik/contracts/accounting";
import type {
  CommissionEntryId,
  CommissionPayoutId,
  CommissionRuleId,
  OrganizationId,
} from "@banijjik/ids";
import type { CommissionEntry } from "../../domain/commission-entry.entity.js";
import type { CommissionPayout } from "../../domain/commission-payout.entity.js";
import type { CommissionRule, CommissionRuleSlot } from "../../domain/commission-rule.entity.js";
import type { CommissionRuleCandidate } from "../../domain/resolve-commission-rule.js";

export interface Page<Item> {
  readonly items: readonly Item[];
  readonly hasNext: boolean;
}

export interface CommissionRuleListFilter {
  readonly subjectType?: CommissionSubjectType | undefined;
  readonly memberId?: string | undefined;
  readonly roleId?: string | undefined;
  readonly status?: CommissionRuleStatus | undefined;
  readonly page: number;
  readonly limit: number;
}

export interface CommissionEntryListFilter {
  readonly memberId?: string | undefined;
  readonly locationId?: string | undefined;
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly page: number;
  readonly limit: number;
}

export interface CommissionMemberTotals {
  readonly memberId: string;
  readonly open: number;
  readonly paid: number;
}

export interface OpenEntriesFilter {
  readonly memberId: string;
  readonly locationId: string;
  readonly upToBusinessDate: string;
  readonly currency: CurrencyCode;
}

export interface OpenEntriesTotal {
  readonly entryCount: number;
  readonly amount: number;
}

export interface CommissionPayoutListFilter {
  readonly memberId?: string | undefined;
  readonly locationId?: string | undefined;
  readonly page: number;
  readonly limit: number;
}

export interface CommissionRuleRepository {
  /** `duplicate` when the unique "one active rule per slot" index refuses the insert. */
  insert(rule: CommissionRule): Promise<"inserted" | "duplicate">;
  save(rule: CommissionRule, expectedVersion: number): Promise<void>;
  findById(commissionRuleId: CommissionRuleId): Promise<CommissionRule | undefined>;
  findActiveBySlot(slot: CommissionRuleSlot): Promise<CommissionRule | undefined>;
  list(filter: CommissionRuleListFilter): Promise<Page<CommissionRule>>;
  /** The ACTIVE rules of a member and of the given roles, for the resolver. */
  listActiveForSubjects(input: {
    readonly memberId: string;
    readonly roleIds: readonly string[];
  }): Promise<readonly CommissionRuleCandidate[]>;
}

export interface CommissionEntryRepository {
  /**
   * Inserts the entry unless its (source, member, sequence) exists. It never raises a duplicate-key
   * error, which would abort the surrounding transaction: an upsert answers `exists` instead.
   */
  insertIfAbsent(entry: CommissionEntry): Promise<"inserted" | "exists">;
  findById(commissionEntryId: CommissionEntryId): Promise<CommissionEntry | undefined>;
  /** Every entry of a source (all members), oldest sequence first. A source has a handful of rows. */
  listBySource(
    sourceType: CommissionSourceType,
    sourceId: string,
  ): Promise<readonly CommissionEntry[]>;
  list(filter: CommissionEntryListFilter): Promise<Page<CommissionEntry>>;
  /** The count and sum of a member's open entries at a location up to a business date, in one currency. */
  summarizeOpen(input: OpenEntriesFilter): Promise<OpenEntriesTotal>;
  /**
   * Sets `payoutId` on the open entries of `OpenEntriesFilter` with one conditional update, so an
   * entry that already has a payout is never taken twice.
   */
  claimOpen(input: OpenEntriesFilter & { readonly payoutId: CommissionPayoutId }): Promise<void>;
  /** The count and sum of the entries a payout claimed (one aggregate, no rows in memory). */
  summarizeClaimed(input: {
    readonly memberId: string;
    readonly locationId: string;
    readonly payoutId: CommissionPayoutId;
    readonly currency: CurrencyCode;
  }): Promise<OpenEntriesTotal>;
  /** Open and paid totals per member in the organization currency, one page of members. */
  summarizeByMember(input: {
    readonly locationId?: string | undefined;
    readonly currency: CurrencyCode;
    readonly page: number;
    readonly limit: number;
  }): Promise<Page<CommissionMemberTotals>>;
}

export interface BookingCommissionFacts {
  readonly bookingId: string;
  readonly bookingNumber: string | null;
  readonly locationId: string;
  readonly providerMemberId: string | null;
  readonly offeringId: string;
  readonly quantity: number;
  readonly status: BookingStatus;
  readonly price: BookingPriceSnapshot;
}

export interface CommissionSourceReader {
  readBooking(bookingId: string): Promise<BookingCommissionFacts | undefined>;
}

/** One line of a sales order, as commission needs it: the performer, the offering and the net money (plan 3.11 Refresh C). */
export interface OrderCommissionLine {
  readonly orderLineId: string;
  readonly offeringId: string;
  readonly quantity: number;
  /** Units given back by returns so far; a return lowers the line commission by its share (ADR-135). */
  readonly returnedQuantity: number;
  readonly lineNetTotal: Money;
  readonly lineTax: Money;
  readonly performedByMemberId: string | null;
}

export interface OrderCommissionFacts {
  readonly orderId: string;
  readonly orderNumber: string | null;
  readonly locationId: string;
  readonly status: OrderStatus;
  readonly grandTotal: Money;
  readonly lines: readonly OrderCommissionLine[];
}

export interface CommissionOrderReader {
  /** Undefined when the order does not exist in this organization. */
  readOrder(orderId: string): Promise<OrderCommissionFacts | undefined>;
}

export interface CommissionPaymentReader {
  readAllocations(paymentId: string): Promise<
    readonly {
      readonly requestType: PaymentRequestType;
      readonly requestId: string;
    }[]
  >;
  /** The source's cumulative refunded total; undefined when it has no payment summary yet (= 0). */
  readRefunded(requestType: PaymentRequestType, requestId: string): Promise<Money | undefined>;
}

export interface CommissionOfferingReader {
  readOffering(offeringId: string): Promise<
    | {
        readonly kind: OfferingKind;
        readonly categoryIds: readonly string[];
      }
    | undefined
  >;
}

export interface CommissionMemberRoleReader {
  /** The role IDs the member holds at the location or at ALL locations. */
  roleIdsAt(memberId: string, locationId: string): Promise<readonly string[]>;
}

export interface CommissionTimezoneReader {
  read(organizationId: OrganizationId): Promise<string>;
}

/** Existence checks for the references a rule names, and the organization facts a rule is checked against. */
export interface CommissionReferenceReader {
  memberExists(memberId: string): Promise<boolean>;
  roleExists(roleId: string): Promise<boolean>;
  categoryExists(categoryId: string): Promise<boolean>;
  offeringExists(offeringId: string): Promise<boolean>;
  enabledKinds(): Promise<readonly OfferingKind[]>;
  organizationCurrency(organizationId: OrganizationId): Promise<CurrencyCode>;
}

export interface CommissionMemberNameReader {
  readNames(memberIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}

export interface CommissionEventPublisher {
  publish(
    type: typeof COMMISSION_EVENT_TYPE.ENTRY_RECORDED,
    payload: CommissionEntryRecordedPayload,
    options: { readonly orderingKey: string },
  ): Promise<void>;
  publish(
    type: typeof COMMISSION_EVENT_TYPE.PAYOUT_PAID,
    payload: CommissionPayoutPaidPayload,
    options: { readonly orderingKey: string },
  ): Promise<void>;
}

export interface CommissionPayoutRepository {
  insert(payout: CommissionPayout): Promise<void>;
  findById(commissionPayoutId: CommissionPayoutId): Promise<CommissionPayout | undefined>;
  list(filter: CommissionPayoutListFilter): Promise<Page<CommissionPayout>>;
}

/**
 * Bumps one marker document per source. An accrual and a refund reconcile for the same booking
 * both bump it inside their transactions, so MongoDB aborts one with a write conflict and its
 * retry reads the state the other committed (plan 3.11, Amendment 2).
 */
export interface CommissionSourceMarkRepository {
  touch(sourceType: CommissionSourceType, sourceId: string): Promise<void>;
}

export interface CommissionUnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}

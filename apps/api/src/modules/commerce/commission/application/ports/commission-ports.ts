import type { CurrencyCode, OfferingKind } from "@banijjik/contracts";
import type { BookingPriceSnapshot, BookingStatus } from "@banijjik/contracts/booking";
import type { COMMISSION_EVENT_TYPE } from "@banijjik/contracts/commission";
import type {
  CommissionRuleStatus,
  CommissionSourceType,
  CommissionSubjectType,
} from "@banijjik/contracts/commission";
import type { PaymentRequestType } from "@banijjik/contracts/payment";
import type { Money } from "@banijjik/contracts/accounting";
import type { CommissionRuleId, OrganizationId } from "@banijjik/ids";
import type { CommissionEntry } from "../../domain/commission-entry.entity.js";
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
  /** Every entry of a source (all members), oldest sequence first. A source has a handful of rows. */
  listBySource(
    sourceType: CommissionSourceType,
    sourceId: string,
  ): Promise<readonly CommissionEntry[]>;
  list(filter: CommissionEntryListFilter): Promise<Page<CommissionEntry>>;
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
    payload: { readonly commissionEntryId: string },
    options: { readonly orderingKey: string },
  ): Promise<void>;
}

export interface CommissionUnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}

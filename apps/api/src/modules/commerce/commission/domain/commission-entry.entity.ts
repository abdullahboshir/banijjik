import type { Money } from "@banijjik/contracts/accounting";
import {
  COMMISSION_ENTRY_KIND,
  COMMISSION_SOURCE_TYPE,
  type CommissionEntryKind,
  type CommissionRuleSnapshot,
  type CommissionSourceType,
} from "@banijjik/contracts/commission";
import {
  asId,
  newId,
  type CommissionEntryId,
  type CommissionPayoutId,
  type LocationId,
  type MemberId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";

/**
 * One line of the append-only commission ledger (ADR-014). It is never edited: a mistake is
 * fixed by a later REFUND_ADJUSTMENT. Only `payoutId` is set once, by a payout (Part A2).
 */
export interface CommissionEntry {
  readonly commissionEntryId: CommissionEntryId;
  readonly organizationId: OrganizationId;
  readonly memberId: MemberId;
  readonly locationId: LocationId;
  readonly sourceType: CommissionSourceType;
  readonly sourceId: string;
  readonly sourceLineId: string | null;
  /** The customer-facing number of the source (booking no.) as it was when the entry was written. */
  readonly sourceNumber: string | null;
  /** 1 for the accrual, then 2, 3, … for the adjustments of the same source and member. */
  readonly sequence: number;
  readonly entryKind: CommissionEntryKind;
  /** Signed: an accrual is above 0; an adjustment is below 0 for a refund and above 0 for a restored one. */
  readonly amount: Money;
  readonly base: Money;
  readonly sourceGrossTotal: Money;
  /** The source's refunded total this entry brought the accrual in line with; 0 for an accrual. */
  readonly refundedTotalSeen: Money;
  readonly ruleSnapshot: CommissionRuleSnapshot;
  readonly businessDate: string;
  readonly payoutId: CommissionPayoutId | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export interface NewCommissionEntryInput {
  readonly organizationId: OrganizationId;
  readonly memberId: MemberId;
  readonly locationId: LocationId;
  readonly sourceId: string;
  readonly sourceNumber: string | null;
  readonly sequence: number;
  readonly amount: Money;
  readonly base: Money;
  readonly sourceGrossTotal: Money;
  readonly refundedTotalSeen: Money;
  readonly ruleSnapshot: CommissionRuleSnapshot;
  readonly businessDate: string;
  readonly now: Date;
  readonly actorUserId: UserId | null;
}

function newEntry(input: NewCommissionEntryInput, entryKind: CommissionEntryKind): CommissionEntry {
  const { now, actorUserId, ...fields } = input;
  return {
    ...fields,
    commissionEntryId: asId<CommissionEntryId>(newId()),
    sourceType: COMMISSION_SOURCE_TYPE.BOOKING,
    sourceLineId: null,
    entryKind,
    payoutId: null,
    createdAt: now,
    updatedAt: now,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId,
  };
}

export function newAccrualEntry(
  input: Omit<NewCommissionEntryInput, "sequence" | "refundedTotalSeen">,
): CommissionEntry {
  return newEntry(
    {
      ...input,
      sequence: 1,
      refundedTotalSeen: { amount: 0, currency: input.amount.currency },
    },
    COMMISSION_ENTRY_KIND.ACCRUAL,
  );
}

export function newRefundAdjustmentEntry(input: NewCommissionEntryInput): CommissionEntry {
  return newEntry(input, COMMISSION_ENTRY_KIND.REFUND_ADJUSTMENT);
}

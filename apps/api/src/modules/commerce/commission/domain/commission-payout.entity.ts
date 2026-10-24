import type { Money } from "@banijjik/contracts/accounting";
import type { CommissionPayoutMethod } from "@banijjik/contracts/commission";
import {
  asId,
  newId,
  type CommissionPayoutId,
  type LocationId,
  type MemberId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";

/**
 * One payment of a member's open commission at one location. Append-only: there is no void in
 * this card, a wrong payout is corrected with a manual journal entry (plan 3.11 decision 7).
 */
export interface CommissionPayout {
  readonly commissionPayoutId: CommissionPayoutId;
  readonly organizationId: OrganizationId;
  readonly payoutNumber: string;
  readonly memberId: MemberId;
  readonly locationId: LocationId;
  readonly upToBusinessDate: string;
  readonly entryCount: number;
  readonly total: Money;
  readonly method: CommissionPayoutMethod;
  readonly externalReference: string | null;
  readonly note: string | null;
  readonly businessDate: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export interface NewCommissionPayoutInput {
  /** The ID the entries were claimed with, so the claim and the payout agree. */
  readonly commissionPayoutId: CommissionPayoutId;
  readonly organizationId: OrganizationId;
  readonly payoutNumber: string;
  readonly memberId: MemberId;
  readonly locationId: LocationId;
  readonly upToBusinessDate: string;
  readonly entryCount: number;
  readonly total: Money;
  readonly method: CommissionPayoutMethod;
  readonly externalReference: string | null;
  readonly note: string | null;
  readonly businessDate: string;
  readonly now: Date;
  readonly actorUserId: UserId | null;
}

export function newCommissionPayoutId(): CommissionPayoutId {
  return asId<CommissionPayoutId>(newId());
}

export function newCommissionPayout(input: NewCommissionPayoutInput): CommissionPayout {
  const { now, actorUserId, ...fields } = input;
  return {
    ...fields,
    createdAt: now,
    updatedAt: now,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId,
  };
}

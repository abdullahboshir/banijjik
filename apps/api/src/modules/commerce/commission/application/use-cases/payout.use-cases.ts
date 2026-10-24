import { AUDIT_ACTION, SEQUENCE_KEY } from "@banijjik/contracts";
import {
  COMMISSION_EVENT_TYPE,
  type CommissionPayoutPreviewResponse,
  type CommissionPayoutResponse,
} from "@banijjik/contracts/commission";
import {
  asId,
  type CommissionPayoutId,
  type LocationId,
  type MemberId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import type {
  CommissionPayoutCreateBody,
  CommissionPayoutListQuery,
  CommissionPayoutPreviewQuery,
} from "@banijjik/validation/commission";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import { nextSequenceValue } from "../../../../../kernel/sequence/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { businessDateOf } from "../../domain/business-date.js";
import {
  newCommissionPayout,
  newCommissionPayoutId,
  type CommissionPayout,
} from "../../domain/commission-payout.entity.js";
import {
  currencyMismatch,
  locationForbidden,
  payoutNothingToPay,
  payoutTotalChanged,
  recordNotFound,
} from "../../domain/errors.js";
import { toPayoutResponse } from "../commission-views.js";
import type {
  CommissionEntryRepository,
  CommissionEventPublisher,
  CommissionPayoutRepository,
  CommissionReferenceReader,
  CommissionTimezoneReader,
  CommissionUnitOfWork,
} from "../ports/commission-ports.js";

type AllowedLocations = readonly string[] | "ALL";
type PayoutCurrency = CommissionPayoutPreviewResponse["total"]["currency"];

export interface PayoutWriteDependencies {
  readonly entries: Pick<
    CommissionEntryRepository,
    "summarizeOpen" | "claimOpen" | "summarizeClaimed"
  >;
  readonly payouts: CommissionPayoutRepository;
  readonly references: Pick<CommissionReferenceReader, "organizationCurrency">;
  readonly timezones: CommissionTimezoneReader;
  readonly events: CommissionEventPublisher;
  readonly unitOfWork: CommissionUnitOfWork;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

export interface PayoutPage {
  readonly items: readonly CommissionPayoutResponse[];
  readonly hasNext: boolean;
}

/** A location the caller is not assigned to is refused, never silently narrowed. */
function assertLocationAllowed(locationId: string | undefined, allowed: AllowedLocations): void {
  if (locationId === undefined || allowed === "ALL") return;
  if (!allowed.includes(locationId)) throw locationForbidden();
}

function formatPayoutNumber(value: number): string {
  return String(value).padStart(6, "0");
}

/** The open entries of a member at a location, so a manager sees the total before confirming it. */
export class PreviewCommissionPayoutUseCase {
  constructor(
    private readonly dependencies: Pick<PayoutWriteDependencies, "entries" | "references">,
  ) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly query: CommissionPayoutPreviewQuery;
    readonly allowedLocationIds: AllowedLocations;
  }): Promise<CommissionPayoutPreviewResponse> {
    const { query } = input;
    assertLocationAllowed(query.location, input.allowedLocationIds);
    const currency = await this.dependencies.references.organizationCurrency(input.organizationId);
    const open = await this.dependencies.entries.summarizeOpen({
      memberId: query.memberId,
      locationId: query.location,
      upToBusinessDate: query.upTo,
      currency,
    });
    return { entryCount: open.entryCount, total: { amount: open.amount, currency } };
  }
}

interface ClaimInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly body: CommissionPayoutCreateBody;
  readonly currency: PayoutCurrency;
  readonly timeZone: string;
}

/**
 * Pays a member's open commission at one location (plan 3.11 decision 7). The claim, the total
 * check and the payout commit together, so a payout that is refused leaves every entry open.
 */
export class CreateCommissionPayoutUseCase {
  constructor(private readonly dependencies: PayoutWriteDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly allowedLocationIds: AllowedLocations;
    readonly body: CommissionPayoutCreateBody;
  }): Promise<CommissionPayoutResponse> {
    const { body } = input;
    assertLocationAllowed(body.locationId, input.allowedLocationIds);
    const currency = await this.dependencies.references.organizationCurrency(input.organizationId);
    if (body.expectedTotal.currency !== currency) throw currencyMismatch();
    const timeZone = await this.dependencies.timezones.read(input.organizationId);
    const payout = await this.dependencies.unitOfWork.run(() =>
      this.claimAndRecord({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        body,
        currency,
        timeZone,
      }),
    );
    return toPayoutResponse(payout);
  }

  private async claimAndRecord(input: ClaimInput): Promise<CommissionPayout> {
    const { body, currency } = input;
    const { entries } = this.dependencies;
    const commissionPayoutId = newCommissionPayoutId();
    const scope = {
      memberId: body.memberId,
      locationId: body.locationId,
      upToBusinessDate: body.upToBusinessDate,
      currency,
    };
    await entries.claimOpen({ ...scope, payoutId: commissionPayoutId });
    const claimed = await entries.summarizeClaimed({ ...scope, payoutId: commissionPayoutId });
    // Aborting rolls the claim back: negative entries wait for the next payout, and a total that moved since the preview is shown again.
    if (claimed.amount <= 0) throw payoutNothingToPay();
    if (claimed.amount !== body.expectedTotal.amount) {
      throw payoutTotalChanged({ amount: claimed.amount, currency });
    }
    const payout = await this.buildPayout(input, commissionPayoutId, claimed.entryCount);
    await this.recordPayout(payout);
    return payout;
  }

  private async buildPayout(
    input: ClaimInput,
    commissionPayoutId: CommissionPayoutId,
    entryCount: number,
  ): Promise<CommissionPayout> {
    const { body } = input;
    const sequenceValue = await nextSequenceValue({
      organizationId: input.organizationId,
      sequenceKey: SEQUENCE_KEY.COMMISSION_PAYOUT,
    });
    const now = this.dependencies.clock.now();
    return newCommissionPayout({
      commissionPayoutId,
      organizationId: input.organizationId,
      payoutNumber: formatPayoutNumber(sequenceValue),
      memberId: asId<MemberId>(body.memberId),
      locationId: asId<LocationId>(body.locationId),
      upToBusinessDate: body.upToBusinessDate,
      entryCount,
      total: body.expectedTotal,
      method: body.method,
      externalReference: body.externalReference ?? null,
      note: body.note ?? null,
      businessDate: businessDateOf(now, input.timeZone),
      now,
      actorUserId: input.actorUserId,
    });
  }

  private async recordPayout(payout: CommissionPayout): Promise<void> {
    const { payouts, audit, events } = this.dependencies;
    await payouts.insert(payout);
    await audit.record({
      action: AUDIT_ACTION.COMMISSION_PAYOUT_CREATED,
      entityType: "commissionPayout",
      entityId: payout.commissionPayoutId,
      changes: { payoutNumber: { to: payout.payoutNumber }, total: { to: payout.total.amount } },
    });
    await events.publish(
      COMMISSION_EVENT_TYPE.PAYOUT_PAID,
      { commissionPayoutId: payout.commissionPayoutId },
      { orderingKey: `commission:${payout.memberId}` },
    );
  }
}

export class ListCommissionPayoutsUseCase {
  constructor(private readonly payouts: Pick<CommissionPayoutRepository, "list">) {}

  async execute(input: {
    readonly query: CommissionPayoutListQuery;
    readonly allowedLocationIds: AllowedLocations;
  }): Promise<PayoutPage> {
    const { query } = input;
    assertLocationAllowed(query.location, input.allowedLocationIds);
    const page = await this.payouts.list({
      memberId: query.memberId,
      locationId: query.location,
      page: query.page,
      limit: query.limit,
    });
    return { items: page.items.map(toPayoutResponse), hasNext: page.hasNext };
  }
}

export class GetCommissionPayoutUseCase {
  constructor(private readonly payouts: Pick<CommissionPayoutRepository, "findById">) {}

  async execute(commissionPayoutId: CommissionPayoutId): Promise<CommissionPayoutResponse> {
    const payout = await this.payouts.findById(commissionPayoutId);
    if (payout === undefined) throw recordNotFound();
    return toPayoutResponse(payout);
  }
}

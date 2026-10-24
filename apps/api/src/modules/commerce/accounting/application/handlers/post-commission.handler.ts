import { MODULE_KEY, type EventEnvelope } from "@banijjik/contracts";
import { COMMISSION_EVENT_TYPE } from "@banijjik/contracts/commission";
import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { EventHandler } from "../../../../../kernel/events/index.js";
import { postingSourceMissing } from "../../domain/errors.js";
import {
  draftCommissionEntryRecorded,
  draftCommissionPaid,
} from "../../domain/commission-posting-rules.js";
import type { CommissionPostingSource } from "../ports/commission-posting-source.js";
import { postJournalEntry, type PostJournalDependencies } from "../post-journal.js";

interface PostCommissionDependencies {
  readonly commissions: CommissionPostingSource;
  readonly posting: PostJournalDependencies;
}

/** Reads one string field of an event payload without a cast; a payload of another shape is a bug. */
function readIdField(payload: unknown, key: string): string {
  if (typeof payload === "object" && payload !== null && key in payload) {
    const value: unknown = Reflect.get(payload, key);
    if (typeof value === "string" && value.length > 0) return value;
  }
  throw postingSourceMissing(`payload.${key}`);
}

/**
 * Posts commission accruals, adjustments and payouts. ORDERED on the `commission:<memberId>`
 * stream and it handles both types published there (plan 3.11, Amendment 1; ADR-136).
 */
export function buildPostCommissionHandler(
  input: PostCommissionDependencies,
): EventHandler<typeof COMMISSION_EVENT_TYPE.ENTRY_RECORDED> {
  return {
    handlerKey: "accounting.postCommission",
    moduleKey: MODULE_KEY.ACCOUNTING,
    eventType: COMMISSION_EVENT_TYPE.ENTRY_RECORDED,
    alsoHandles: [COMMISSION_EVENT_TYPE.PAYOUT_PAID],
    ordering: "ORDERED",
    streamPrefixes: ["commission:"],
    async handle(envelope) {
      await handleCommissionEvent(input, envelope);
    },
  };
}

async function handleCommissionEvent(
  input: PostCommissionDependencies,
  envelope: EventEnvelope<unknown>,
): Promise<void> {
  if (envelope.organizationId === null) throw postingSourceMissing("organization");
  const organizationId = asId<OrganizationId>(envelope.organizationId);
  const actorUserId = envelope.actorUserId === null ? null : asId<UserId>(envelope.actorUserId);

  if (envelope.type === COMMISSION_EVENT_TYPE.PAYOUT_PAID) {
    const commissionPayoutId = readIdField(envelope.payload, "commissionPayoutId");
    const payout = await input.commissions.readPayout(commissionPayoutId);
    if (payout === undefined) throw postingSourceMissing(`commissionPayout:${commissionPayoutId}`);
    await postJournalEntry(input.posting, {
      organizationId,
      actorUserId,
      draft: draftCommissionPaid(payout),
    });
    return;
  }

  const commissionEntryId = readIdField(envelope.payload, "commissionEntryId");
  const recorded = await input.commissions.readEntry(commissionEntryId);
  if (recorded === undefined) throw postingSourceMissing(`commissionEntry:${commissionEntryId}`);
  await postJournalEntry(input.posting, {
    organizationId,
    actorUserId,
    draft: draftCommissionEntryRecorded(recorded),
  });
}

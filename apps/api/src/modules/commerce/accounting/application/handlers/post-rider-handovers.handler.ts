import {
  DELIVERY_EVENT_TYPE,
  MODULE_KEY,
  type EventEnvelope,
  type RiderCashHandoverEventPayload,
} from "@banijjik/contracts";
import {
  JOURNAL_SOURCE_TYPE,
  POSTING_KEY,
  SYSTEM_ACCOUNT_CODE,
} from "@banijjik/contracts/accounting";
import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { EventHandler } from "../../../../../kernel/events/index.js";
import { postingSourceMissing } from "../../domain/errors.js";
import {
  draftRiderHandover,
  type RiderHandoverPostingSnapshot,
} from "../../domain/settlement-posting-rules.js";
import { ensureSystemAccount } from "../ensure-system-account.js";
import type { RiderHandoverPostingSource } from "../ports/rider-handover-posting-source.js";
import { postJournalEntry, postReversal, type PostJournalDependencies } from "../post-journal.js";

interface RiderHandoverHandlerInput {
  readonly riderHandovers: RiderHandoverPostingSource;
  readonly posting: PostJournalDependencies;
}

export function buildPostRiderHandoversHandler(
  input: RiderHandoverHandlerInput,
): EventHandler<typeof DELIVERY_EVENT_TYPE.HANDOVER_RECORDED> {
  return {
    handlerKey: "accounting.postRiderHandovers",
    moduleKey: MODULE_KEY.ACCOUNTING,
    eventType: DELIVERY_EVENT_TYPE.HANDOVER_RECORDED,
    alsoHandles: [DELIVERY_EVENT_TYPE.HANDOVER_REVERSED],
    ordering: "ORDERED",
    streamPrefixes: ["riderHandover:"],
    async handle(envelope: EventEnvelope<RiderCashHandoverEventPayload>) {
      await handleRiderHandoverEvent(input, envelope);
    },
  };
}

function parseActor(envelope: EventEnvelope<RiderCashHandoverEventPayload>): {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId | null;
} {
  if (!envelope.organizationId) throw postingSourceMissing("organization");
  return {
    organizationId: asId<OrganizationId>(envelope.organizationId),
    actorUserId: envelope.actorUserId ? asId<UserId>(envelope.actorUserId) : null,
  };
}

async function handleRiderHandoverEvent(
  input: RiderHandoverHandlerInput,
  envelope: EventEnvelope<RiderCashHandoverEventPayload>,
): Promise<void> {
  if (envelope.type === DELIVERY_EVENT_TYPE.HANDOVER_RECORDED) {
    await postHandoverRecorded(input, envelope);
  } else if (envelope.type === DELIVERY_EVENT_TYPE.HANDOVER_REVERSED) {
    await postHandoverReversed(input, envelope);
  }
}

async function postHandoverRecorded(
  input: RiderHandoverHandlerInput,
  envelope: EventEnvelope<RiderCashHandoverEventPayload>,
): Promise<void> {
  const actor = parseActor(envelope);
  const handoverId = envelope.payload.riderCashHandoverId;
  const snapshot = await input.riderHandovers.readRiderHandover(handoverId);
  if (!snapshot) {
    throw postingSourceMissing(`riderCashHandover:${handoverId}`);
  }

  // Verify prerequisite payment collection journals exist before clearing rider cash (4.3 COD J2)
  await verifyPaymentJournals(input, snapshot);

  // Ensure system account RIDER_CASH exists in case it was not seeded in older organizations
  await ensureSystemAccount(
    { accounts: input.posting.accounts, clock: input.posting.clock },
    { organizationId: actor.organizationId, accountCode: SYSTEM_ACCOUNT_CODE.RIDER_CASH },
  );

  const draft = draftRiderHandover(snapshot);
  await postJournalEntry(input.posting, { ...actor, draft });
}

async function postHandoverReversed(
  input: RiderHandoverHandlerInput,
  envelope: EventEnvelope<RiderCashHandoverEventPayload>,
): Promise<void> {
  const actor = parseActor(envelope);
  const handoverId = envelope.payload.riderCashHandoverId;
  const snapshot = await input.riderHandovers.readRiderHandover(handoverId);
  if (!snapshot) {
    throw postingSourceMissing(`riderCashHandover:${handoverId}`);
  }

  const originalId =
    envelope.payload.reversesRiderCashHandoverId ??
    snapshot.reversesRiderCashHandoverId ??
    handoverId;

  const originalJournal = await input.posting.journals.findBySource({
    sourceType: JOURNAL_SOURCE_TYPE.DELIVERY,
    sourceId: originalId,
    postingKey: POSTING_KEY.rider_handover,
  });

  if (!originalJournal) {
    throw postingSourceMissing(`rider-handover-journal:${originalId}`);
  }

  await postReversal(input.posting, {
    organizationId: actor.organizationId,
    actorUserId: actor.actorUserId,
    original: originalJournal,
    postingKey: POSTING_KEY.reversal_rider_handover,
    businessDate: snapshot.businessDate,
  });
}

async function verifyPaymentJournals(
  input: RiderHandoverHandlerInput,
  snapshot: RiderHandoverPostingSnapshot,
): Promise<void> {
  for (const paymentId of snapshot.paymentIds) {
    const journal = await input.posting.journals.findBySource({
      sourceType: JOURNAL_SOURCE_TYPE.PAYMENT,
      sourceId: paymentId,
      postingKey: POSTING_KEY.payment_in_after_revenue,
    });
    if (!journal) {
      throw postingSourceMissing(`prerequisite-payment-journal:${paymentId}`);
    }
  }
}

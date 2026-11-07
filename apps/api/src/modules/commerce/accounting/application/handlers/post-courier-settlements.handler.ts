import {
  COURIER_EVENT_TYPE,
  MODULE_KEY,
  type CourierSettlementEventPayload,
  type EventEnvelope,
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
  draftCourierSettlement,
  type CourierSettlementPostingSnapshot,
} from "../../domain/settlement-posting-rules.js";
import { ensureSystemAccount } from "../ensure-system-account.js";
import type { CourierSettlementPostingSource } from "../ports/courier-settlement-posting-source.js";
import { postJournalEntry, postReversal, type PostJournalDependencies } from "../post-journal.js";

interface CourierSettlementHandlerInput {
  readonly courierSettlements: CourierSettlementPostingSource;
  readonly posting: PostJournalDependencies;
}

export function buildPostCourierSettlementsHandler(
  input: CourierSettlementHandlerInput,
): EventHandler<typeof COURIER_EVENT_TYPE.SETTLEMENT_RECORDED> {
  return {
    handlerKey: "accounting.postCourierSettlements",
    moduleKey: MODULE_KEY.ACCOUNTING,
    eventType: COURIER_EVENT_TYPE.SETTLEMENT_RECORDED,
    alsoHandles: [COURIER_EVENT_TYPE.SETTLEMENT_REVERSED],
    ordering: "ORDERED",
    streamPrefixes: ["courierSettlement:"],
    async handle(envelope: EventEnvelope<CourierSettlementEventPayload>) {
      await handleCourierSettlementEvent(input, envelope);
    },
  };
}

function parseActor(envelope: EventEnvelope<CourierSettlementEventPayload>): {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId | null;
} {
  if (!envelope.organizationId) throw postingSourceMissing("organization");
  return {
    organizationId: asId<OrganizationId>(envelope.organizationId),
    actorUserId: envelope.actorUserId ? asId<UserId>(envelope.actorUserId) : null,
  };
}

async function handleCourierSettlementEvent(
  input: CourierSettlementHandlerInput,
  envelope: EventEnvelope<CourierSettlementEventPayload>,
): Promise<void> {
  if (envelope.type === COURIER_EVENT_TYPE.SETTLEMENT_RECORDED) {
    await postSettlementRecorded(input, envelope);
  } else if (envelope.type === COURIER_EVENT_TYPE.SETTLEMENT_REVERSED) {
    await postSettlementReversed(input, envelope);
  }
}

async function postSettlementRecorded(
  input: CourierSettlementHandlerInput,
  envelope: EventEnvelope<CourierSettlementEventPayload>,
): Promise<void> {
  const actor = parseActor(envelope);
  const settlementId = envelope.payload.courierSettlementId;
  const snapshot = await input.courierSettlements.readCourierSettlement(settlementId);
  if (!snapshot) {
    throw postingSourceMissing(`courierSettlement:${settlementId}`);
  }

  // Verify prerequisite payment collection journals exist before clearing receivable (4.3 COD J2)
  await verifyPaymentJournals(input, snapshot);

  // Ensure system accounts exist in case they were not seeded in older organizations
  await ensureSystemAccount(
    { accounts: input.posting.accounts, clock: input.posting.clock },
    { organizationId: actor.organizationId, accountCode: SYSTEM_ACCOUNT_CODE.COURIER_RECEIVABLE },
  );
  if (snapshot.courierCharges.amount > 0) {
    await ensureSystemAccount(
      { accounts: input.posting.accounts, clock: input.posting.clock },
      { organizationId: actor.organizationId, accountCode: SYSTEM_ACCOUNT_CODE.COURIER_FEES },
    );
  }

  const draft = draftCourierSettlement(snapshot);
  await postJournalEntry(input.posting, { ...actor, draft });
}

async function postSettlementReversed(
  input: CourierSettlementHandlerInput,
  envelope: EventEnvelope<CourierSettlementEventPayload>,
): Promise<void> {
  const actor = parseActor(envelope);
  const settlementId = envelope.payload.courierSettlementId;
  const snapshot = await input.courierSettlements.readCourierSettlement(settlementId);
  if (!snapshot) {
    throw postingSourceMissing(`courierSettlement:${settlementId}`);
  }

  const originalId =
    envelope.payload.reversesCourierSettlementId ??
    snapshot.reversesCourierSettlementId ??
    settlementId;

  const originalJournal = await input.posting.journals.findBySource({
    sourceType: JOURNAL_SOURCE_TYPE.COURIER,
    sourceId: originalId,
    postingKey: POSTING_KEY.courier_settlement,
  });

  if (!originalJournal) {
    throw postingSourceMissing(`courier-settlement-journal:${originalId}`);
  }

  await postReversal(input.posting, {
    organizationId: actor.organizationId,
    actorUserId: actor.actorUserId,
    original: originalJournal,
    postingKey: POSTING_KEY.reversal_courier_settlement,
    businessDate: snapshot.businessDate,
  });
}

async function verifyPaymentJournals(
  input: CourierSettlementHandlerInput,
  snapshot: CourierSettlementPostingSnapshot,
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

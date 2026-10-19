import { EVENT_TYPE, MODULE_KEY, type EventEnvelope } from "@banijjik/contracts";
import { JOURNAL_SOURCE_TYPE, POSTING_KEY } from "@banijjik/contracts/accounting";
import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { EventHandler } from "../../../../../kernel/events/index.js";
import { postingSourceMissing } from "../../domain/errors.js";
import {
  draftPaymentReceived,
  draftPaymentRefund,
  draftStoreCreditExpiry,
  type PaymentPostingSnapshot,
} from "../../domain/posting-rules.js";
import type { PaymentPostingSource } from "../ports/payment-posting-source.js";
import { postJournalEntry, postReversal, type PostJournalDependencies } from "../post-journal.js";

type AnyPaymentEnvelope = EventEnvelope<{ paymentId?: string; storeCreditEntryId?: string }>;

interface PaymentHandlerInput {
  readonly payments: PaymentPostingSource;
  readonly posting: PostJournalDependencies;
}

export function buildPostPaymentsHandler(
  input: PaymentHandlerInput,
): EventHandler<typeof EVENT_TYPE.PAYMENT_RECEIVED> {
  return {
    handlerKey: "accounting.postPayments",
    moduleKey: MODULE_KEY.ACCOUNTING,
    eventType: EVENT_TYPE.PAYMENT_RECEIVED,
    alsoHandles: [
      EVENT_TYPE.PAYMENT_REFUNDED,
      EVENT_TYPE.PAYMENT_REVERSED,
      EVENT_TYPE.STORE_CREDIT_CHANGED,
    ],
    ordering: "ORDERED",
    async handle(envelope) {
      await handlePaymentEvent(input, envelope as unknown as AnyPaymentEnvelope);
    },
  };
}

function organizationActor(envelope: AnyPaymentEnvelope): {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId | null;
} {
  if (envelope.organizationId === null) throw postingSourceMissing("organization");
  return {
    organizationId: asId<OrganizationId>(envelope.organizationId),
    actorUserId: envelope.actorUserId === null ? null : asId<UserId>(envelope.actorUserId),
  };
}

async function requirePayment(
  payments: PaymentPostingSource,
  paymentId: string | undefined,
): Promise<PaymentPostingSnapshot> {
  if (paymentId === undefined) throw postingSourceMissing("paymentId");
  const snapshot = await payments.readPayment(paymentId);
  if (snapshot === undefined) throw postingSourceMissing(`payment:${paymentId}`);
  return snapshot;
}

async function postStoreCreditChange(
  input: PaymentHandlerInput,
  envelope: AnyPaymentEnvelope,
): Promise<void> {
  const { organizationId, actorUserId } = organizationActor(envelope);
  const entryId = envelope.payload.storeCreditEntryId;
  if (entryId === undefined) throw postingSourceMissing("storeCreditEntryId");
  const snapshot = await input.payments.readStoreCreditEntry(entryId);
  if (snapshot === undefined) throw postingSourceMissing(`storeCredit:${entryId}`);
  await postJournalEntry(input.posting, {
    organizationId,
    actorUserId,
    draft: draftStoreCreditExpiry(snapshot),
  });
}

async function postPaymentReversal(
  input: PaymentHandlerInput,
  actor: { readonly organizationId: OrganizationId; readonly actorUserId: UserId | null },
  snapshot: PaymentPostingSnapshot,
): Promise<void> {
  const originalId = snapshot.reversesPaymentId ?? snapshot.paymentId;
  const candidates = [
    POSTING_KEY.payment_in_advance,
    POSTING_KEY.payment_in_after_revenue,
    POSTING_KEY.payment_store_credit,
  ] as const;
  for (const postingKey of candidates) {
    const target = await input.posting.journals.findBySource({
      sourceType: JOURNAL_SOURCE_TYPE.PAYMENT,
      sourceId: originalId,
      postingKey,
    });
    if (target === undefined) continue;
    await postReversal(input.posting, {
      organizationId: actor.organizationId,
      actorUserId: actor.actorUserId,
      original: target,
      postingKey: POSTING_KEY.reversal,
      businessDate: snapshot.businessDate,
    });
    return;
  }
  throw postingSourceMissing(`payment-reversal:${originalId}`);
}

async function handlePaymentEvent(
  input: PaymentHandlerInput,
  envelope: AnyPaymentEnvelope,
): Promise<void> {
  if (envelope.type === EVENT_TYPE.STORE_CREDIT_CHANGED) {
    await postStoreCreditChange(input, envelope);
    return;
  }
  const { organizationId, actorUserId } = organizationActor(envelope);
  const snapshot = await requirePayment(input.payments, envelope.payload.paymentId);
  if (envelope.type === EVENT_TYPE.PAYMENT_RECEIVED) {
    for (const draft of draftPaymentReceived(snapshot)) {
      await postJournalEntry(input.posting, { organizationId, actorUserId, draft });
    }
    return;
  }
  if (envelope.type === EVENT_TYPE.PAYMENT_REFUNDED) {
    for (const draft of draftPaymentRefund(snapshot)) {
      await postJournalEntry(input.posting, { organizationId, actorUserId, draft });
    }
    return;
  }
  await postPaymentReversal(input, { organizationId, actorUserId }, snapshot);
}

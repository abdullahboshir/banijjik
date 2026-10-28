import {
  EVENT_TYPE,
  MODULE_KEY,
  type EventEnvelope,
  type EventPayloadMap,
  type EventType,
} from "@banijjik/contracts";
import {
  JOURNAL_SOURCE_TYPE,
  POSTING_KEY,
  SYSTEM_ACCOUNT_CODE,
  reversalPostingKeyFor,
} from "@banijjik/contracts/accounting";
import { STORE_CREDIT_ENTRY_KIND } from "@banijjik/contracts/payment";
import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { EventHandler } from "../../../../../kernel/events/index.js";
import { postingSourceMissing } from "../../domain/errors.js";
import {
  draftPaymentReceived,
  draftPaymentRefund,
  draftStoreCreditExpiry,
  type PaymentPostingSnapshot,
} from "../../domain/posting-rules.js";
import { ensureSystemAccount } from "../ensure-system-account.js";
import { draftBadDebtWriteOff } from "../../domain/write-off-posting-rules.js";
import type { PaymentPostingSource } from "../ports/payment-posting-source.js";
import { postJournalEntry, postReversal, type PostJournalDependencies } from "../post-journal.js";
import type { PaymentEventPayload, StoreCreditEventPayload } from "@banijjik/contracts/payment";

type AnyPaymentEnvelope = EventEnvelope<PaymentEventPayload | StoreCreditEventPayload>;

type TypedEventEnvelope<Type extends EventType> = Type extends EventType
  ? EventEnvelope<EventPayloadMap[Type]> & { readonly type: Type }
  : never;

function isEventType<Type extends EventType>(
  envelope: EventEnvelope<unknown>,
  type: Type,
): envelope is TypedEventEnvelope<Type> {
  return envelope.type === type;
}

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
    streamPrefixes: ["paymentAccount:"],
    async handle(envelope) {
      await handlePaymentEvent(input, envelope);
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
  envelope: EventEnvelope<StoreCreditEventPayload>,
): Promise<void> {
  const { organizationId, actorUserId } = organizationActor(envelope);
  const entryId = envelope.payload.storeCreditEntryId;
  if (entryId === undefined) throw postingSourceMissing("storeCreditEntryId");
  const snapshot = await input.payments.readStoreCreditEntry(entryId);
  if (snapshot === undefined) throw postingSourceMissing(`storeCredit:${entryId}`);
  if (snapshot.kind !== STORE_CREDIT_ENTRY_KIND.EXPIRY) return;
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
    POSTING_KEY.overpayment_to_store_credit,
  ] as const;
  let reversedCount = 0;
  for (const postingKey of candidates) {
    const target = await input.posting.journals.findBySource({
      sourceType: JOURNAL_SOURCE_TYPE.PAYMENT,
      sourceId: originalId,
      postingKey,
    });
    if (target === undefined) continue;
    const reversalPostingKey = reversalPostingKeyFor(postingKey);
    await postReversal(input.posting, {
      organizationId: actor.organizationId,
      actorUserId: actor.actorUserId,
      original: target,
      postingKey: reversalPostingKey,
      businessDate: snapshot.businessDate,
    });
    reversedCount++;
  }
  if (reversedCount === 0) {
    throw postingSourceMissing(`payment-reversal:${originalId}`);
  }
  await postBadDebtWriteOff(input, actor, snapshot);
}

async function postBadDebtWriteOff(
  input: PaymentHandlerInput,
  actor: { readonly organizationId: OrganizationId; readonly actorUserId: UserId | null },
  snapshot: PaymentPostingSnapshot,
): Promise<void> {
  const draft = draftBadDebtWriteOff(snapshot);
  if (draft === undefined) return;
  // Organizations seeded before card 3.34 may not have the account yet.
  await ensureSystemAccount(
    { accounts: input.posting.accounts, clock: input.posting.clock },
    { organizationId: actor.organizationId, accountCode: SYSTEM_ACCOUNT_CODE.BAD_DEBT_EXPENSE },
  );
  await postJournalEntry(input.posting, { ...actor, draft });
}

async function handlePaymentEvent(
  input: PaymentHandlerInput,
  envelope: AnyPaymentEnvelope,
): Promise<void> {
  switch (envelope.type) {
    case EVENT_TYPE.STORE_CREDIT_CHANGED:
      if (!isEventType(envelope, EVENT_TYPE.STORE_CREDIT_CHANGED)) return;
      await postStoreCreditChange(input, envelope);
      return;
    case EVENT_TYPE.PAYMENT_RECEIVED:
      if (!isEventType(envelope, EVENT_TYPE.PAYMENT_RECEIVED)) return;
      await postPaymentReceived(input, envelope);
      return;
    case EVENT_TYPE.PAYMENT_REFUNDED:
      if (!isEventType(envelope, EVENT_TYPE.PAYMENT_REFUNDED)) return;
      await postPaymentRefunded(input, envelope);
      return;
    case EVENT_TYPE.PAYMENT_REVERSED:
      if (!isEventType(envelope, EVENT_TYPE.PAYMENT_REVERSED)) return;
      await postPaymentReversed(input, envelope);
      return;
    default:
      return;
  }
}

async function postPaymentReceived(
  input: PaymentHandlerInput,
  envelope: TypedEventEnvelope<typeof EVENT_TYPE.PAYMENT_RECEIVED>,
): Promise<void> {
  const actor = organizationActor(envelope);
  const snapshot = await requirePayment(input.payments, envelope.payload.paymentId);
  for (const draft of draftPaymentReceived(snapshot)) {
    await postJournalEntry(input.posting, { ...actor, draft });
  }
}

async function postPaymentRefunded(
  input: PaymentHandlerInput,
  envelope: TypedEventEnvelope<typeof EVENT_TYPE.PAYMENT_REFUNDED>,
): Promise<void> {
  const actor = organizationActor(envelope);
  const snapshot = await requirePayment(input.payments, envelope.payload.paymentId);
  for (const draft of draftPaymentRefund(snapshot)) {
    await postJournalEntry(input.posting, { ...actor, draft });
  }
}

async function postPaymentReversed(
  input: PaymentHandlerInput,
  envelope: TypedEventEnvelope<typeof EVENT_TYPE.PAYMENT_REVERSED>,
): Promise<void> {
  const actor = organizationActor(envelope);
  const snapshot = await requirePayment(input.payments, envelope.payload.paymentId);
  await postPaymentReversal(input, actor, snapshot);
}

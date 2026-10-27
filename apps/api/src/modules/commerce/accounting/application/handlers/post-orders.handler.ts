import { EVENT_TYPE, MODULE_KEY, type EventEnvelope } from "@banijjik/contracts";
import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { EventHandler } from "../../../../../kernel/events/index.js";
import { postingSourceMissing } from "../../domain/errors.js";
import { draftOrderCompleted } from "../../domain/order-posting-rules.js";
import type { OrderPostingSource } from "../ports/order-posting-source.js";
import { postJournalEntry, type PostJournalDependencies } from "../post-journal.js";

export function buildPostOrdersHandler(input: {
  readonly orders: OrderPostingSource;
  readonly posting: PostJournalDependencies;
}): EventHandler<typeof EVENT_TYPE.ORDER_COMPLETED> {
  return {
    handlerKey: "accounting.postOrders",
    moduleKey: MODULE_KEY.ACCOUNTING,
    eventType: EVENT_TYPE.ORDER_COMPLETED,
    ordering: "ORDERED",
    streamPrefixes: ["order:"],
    async handle(envelope) {
      await handleOrderCompleted(input, envelope);
    },
  };
}

async function handleOrderCompleted(
  input: {
    readonly orders: OrderPostingSource;
    readonly posting: PostJournalDependencies;
  },
  envelope: EventEnvelope<{ orderId: string }>,
): Promise<void> {
  if (envelope.type !== EVENT_TYPE.ORDER_COMPLETED) return;
  if (envelope.organizationId === null) throw postingSourceMissing("organization");
  const organizationId = asId<OrganizationId>(envelope.organizationId);
  const actorUserId = envelope.actorUserId === null ? null : asId<UserId>(envelope.actorUserId);

  const snapshot = await input.orders.readOrder(envelope.payload.orderId);
  if (snapshot === undefined) {
    throw postingSourceMissing(`order:${envelope.payload.orderId}`);
  }

  for (const draft of draftOrderCompleted(snapshot)) {
    await postJournalEntry(input.posting, { organizationId, actorUserId, draft });
  }
}

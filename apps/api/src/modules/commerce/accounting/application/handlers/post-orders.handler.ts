import { EVENT_TYPE, MODULE_KEY, type EventEnvelope } from "@banijjik/contracts";
import {
  JOURNAL_SOURCE_TYPE,
  POSTING_KEY,
  reversalPostingKeyFor,
} from "@banijjik/contracts/accounting";
import { SALES_EVENT_TYPE } from "@banijjik/contracts/sales";
import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { EventHandler } from "../../../../../kernel/events/index.js";
import { postingSourceMissing } from "../../domain/errors.js";
import {
  draftDeliveryLoss,
  draftDeliveryLossRecovery,
  draftOrderCompleted,
  type OrderPostingSnapshot,
} from "../../domain/order-posting-rules.js";
import type { OrderPostingSource } from "../ports/order-posting-source.js";
import {
  postJournalEntry,
  postReversal,
  type PostJournalDependencies,
} from "../post-journal.js";

interface PostOrderContext {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId | null;
}

export function buildPostOrdersHandler(input: {
  readonly orders: OrderPostingSource;
  readonly posting: PostJournalDependencies;
}): EventHandler<typeof EVENT_TYPE.ORDER_COMPLETED> {
  return {
    handlerKey: "accounting.postOrders",
    moduleKey: MODULE_KEY.ACCOUNTING,
    eventType: EVENT_TYPE.ORDER_COMPLETED,
    alsoHandles: [
      SALES_EVENT_TYPE.ORDER_SHIPPED,
      SALES_EVENT_TYPE.ORDER_RETURNED_TO_SENDER,
      SALES_EVENT_TYPE.ORDER_DELIVERY_LOSS_CLOSED,
      SALES_EVENT_TYPE.DELIVERY_LOSS_RECOVERED,
    ],
    ordering: "ORDERED",
    streamPrefixes: ["order:"],
    async handle(envelope) {
      await dispatchOrderEvent(input, envelope as unknown as EventEnvelope<Record<string, unknown>>);
    },
  };
}

async function dispatchOrderEvent(
  input: {
    readonly orders: OrderPostingSource;
    readonly posting: PostJournalDependencies;
  },
  envelope: EventEnvelope<Record<string, unknown>>,
): Promise<void> {
  if (envelope.organizationId === null) throw postingSourceMissing("organization");
  const ctx: PostOrderContext = {
    organizationId: asId<OrganizationId>(envelope.organizationId),
    actorUserId: envelope.actorUserId === null ? null : asId<UserId>(envelope.actorUserId),
  };

  if (envelope.type === SALES_EVENT_TYPE.DELIVERY_LOSS_RECOVERED) {
    await handleDeliveryLossRecovered(input, ctx, envelope);
    return;
  }

  const orderId = String(envelope.payload.orderId ?? "");
  const snapshot = await input.orders.readOrder(orderId);
  if (snapshot === undefined) {
    throw postingSourceMissing(`order:${orderId}`);
  }

  await routeOrderSnapshotEvent(input, ctx, envelope.type, snapshot);
}

async function routeOrderSnapshotEvent(
  input: { readonly orders: OrderPostingSource; readonly posting: PostJournalDependencies },
  ctx: PostOrderContext,
  eventType: string,
  snapshot: OrderPostingSnapshot,
): Promise<void> {
  if (
    eventType === EVENT_TYPE.ORDER_COMPLETED ||
    eventType === SALES_EVENT_TYPE.ORDER_SHIPPED
  ) {
    await handleOrderCompletedOrShipped(input, ctx, snapshot);
  } else if (eventType === SALES_EVENT_TYPE.ORDER_RETURNED_TO_SENDER) {
    await handleOrderRts(input, ctx, snapshot);
  } else if (eventType === SALES_EVENT_TYPE.ORDER_DELIVERY_LOSS_CLOSED) {
    await handleDeliveryLossClosed(input, ctx, snapshot);
  }
}

async function handleOrderCompletedOrShipped(
  input: { readonly posting: PostJournalDependencies },
  ctx: PostOrderContext,
  snapshot: OrderPostingSnapshot,
): Promise<void> {
  for (const draft of draftOrderCompleted(snapshot)) {
    await postJournalEntry(input.posting, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.actorUserId,
      draft,
    });
  }
}

async function handleOrderRts(
  input: { readonly posting: PostJournalDependencies },
  ctx: PostOrderContext,
  snapshot: OrderPostingSnapshot,
): Promise<void> {
  const keys = [
    POSTING_KEY.order_revenue,
    POSTING_KEY.order_advance_settle,
    POSTING_KEY.order_cost,
  ];
  for (const postingKey of keys) {
    const original = await input.posting.journals.findBySource({
      sourceType: JOURNAL_SOURCE_TYPE.ORDER,
      sourceId: snapshot.orderId,
      postingKey,
    });
    if (original === undefined) continue;
    await postReversal(input.posting, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.actorUserId,
      original,
      postingKey: reversalPostingKeyFor(postingKey),
      businessDate: snapshot.businessDate,
    });
  }
}

async function handleDeliveryLossClosed(
  input: { readonly posting: PostJournalDependencies },
  ctx: PostOrderContext,
  snapshot: OrderPostingSnapshot,
): Promise<void> {
  const keys = [POSTING_KEY.order_revenue, POSTING_KEY.order_advance_settle];
  for (const postingKey of keys) {
    const original = await input.posting.journals.findBySource({
      sourceType: JOURNAL_SOURCE_TYPE.ORDER,
      sourceId: snapshot.orderId,
      postingKey,
    });
    if (original === undefined) continue;
    await postReversal(input.posting, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.actorUserId,
      original,
      postingKey: reversalPostingKeyFor(postingKey),
      businessDate: snapshot.businessDate,
    });
  }

  for (const draft of draftDeliveryLoss(snapshot)) {
    await postJournalEntry(input.posting, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.actorUserId,
      draft,
    });
  }
}

async function handleDeliveryLossRecovered(
  input: {
    readonly orders: OrderPostingSource;
    readonly posting: PostJournalDependencies;
  },
  ctx: PostOrderContext,
  envelope: EventEnvelope<Record<string, unknown>>,
): Promise<void> {
  if (!input.orders.readDeliveryLossRecovery) return;
  const recoveryId = String(envelope.payload.deliveryLossRecoveryId ?? "");
  const recovery = await input.orders.readDeliveryLossRecovery(recoveryId);
  if (recovery === undefined) {
    throw postingSourceMissing(`deliveryLossRecovery:${recoveryId}`);
  }

  for (const draft of draftDeliveryLossRecovery(recovery)) {
    await postJournalEntry(input.posting, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.actorUserId,
      draft,
    });
  }
}

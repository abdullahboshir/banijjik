import type { Model } from "mongoose";
import { EVENT_TYPE } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { runWithRequestContext } from "../kernel/context/index.js";
import { models, withTransaction } from "../kernel/db/index.js";
import {
  OUTBOX_EVENT_MODEL_NAME,
  type OutboxEventDocument,
} from "../kernel/events/outbox-event.schema.js";
import { publishEvent } from "../kernel/events/publish-event.js";

export function outboxModel(): Model<OutboxEventDocument> {
  return models({}).get<OutboxEventDocument>(OUTBOX_EVENT_MODEL_NAME);
}

export interface PublishedTestEvent {
  readonly eventId: string;
  readonly type: string;
  readonly organizationId: string | null;
}

async function publishInContext(organizationId: string | null): Promise<void> {
  const context = { requestId: newId(), ...(organizationId === null ? {} : { organizationId }) };
  await runWithRequestContext(context, () =>
    withTransaction(() => publishEvent(EVENT_TYPE.USER_REGISTERED, { userId: newId() })),
  );
}

/**
 * Publishes one `iam.user.registered` the way a use case does: inside a transaction, in a request
 * context of the given organization (or none). Call it one at a time: the newest outbox row is returned.
 */
export async function publishTestEvent(
  organizationId: string | null = null,
): Promise<PublishedTestEvent> {
  await publishInContext(organizationId);
  const row = await outboxModel().findOne({}).sort({ createdAt: -1 }).lean<OutboxEventDocument>();
  if (row === null) throw new Error("the event was not written");
  return { eventId: row.eventId, type: row.type, organizationId: row.organizationId };
}

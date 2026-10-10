import {
  ERROR_CODE,
  OUTBOX_STATUS,
  type EventPayloadMap,
  type EventType,
} from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { getRequestContext } from "../context/index.js";
import { getActiveSession, models } from "../db/index.js";
import { AppError } from "../http/app-error.js";
import { systemClock } from "../time/index.js";
import { OUTBOX_EVENT_MODEL_NAME, type OutboxEventDocument } from "./outbox-event.schema.js";

export interface PublishEventOptions {
  /** Version of the payload shape. Raise it when a payload changes in a way consumers must notice. */
  readonly version?: number;
}

/**
 * Writes a domain event to the outbox in the active transaction, so the event exists exactly when
 * the change does. Without a transaction it throws: an event without its change, or a change
 * without its event, is a bug, never a case to cover with an inline send (ADR-090). A worker
 * delivers it after the commit; nothing is sent here.
 */
export async function publishEvent<Type extends EventType>(
  type: Type,
  payload: EventPayloadMap[Type],
  options: PublishEventOptions = {},
): Promise<void> {
  const session = getActiveSession();
  if (session === undefined) {
    throw new AppError({
      code: ERROR_CODE.INTERNAL,
      messageKey: "errors.event_needs_transaction",
      details: { type },
    });
  }
  const context = getRequestContext();
  const actorUserId = context.userId ?? null;
  const now = systemClock.now();
  const Outbox = models({}).get<OutboxEventDocument>(OUTBOX_EVENT_MODEL_NAME);
  await Outbox.create(
    [
      {
        eventId: newId(),
        type,
        version: options.version ?? 1,
        occurredAt: now,
        organizationId: context.organizationId ?? null,
        actorUserId,
        requestId: context.requestId,
        payload: { ...payload },
        status: OUTBOX_STATUS.PENDING,
        dispatchAttempts: 0,
        nextAttemptAt: now,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
      },
    ],
    { session },
  );
}

/**
 * The object modules receive for their own `EventPublisher` port (wired in the module's index.ts),
 * so a module never imports the kernel's publish function into its application layer.
 */
export const kernelEventPublisher = { publish: publishEvent };

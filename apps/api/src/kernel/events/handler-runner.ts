import {
  ERROR_CODE,
  SYSTEM_REASON,
  type EventEnvelope,
  type EventPayloadMap,
  type EventType,
} from "@banijjik/contracts";
import { AppError } from "../http/app-error.js";
import { newId } from "@banijjik/ids";
import { runAsSystem, runWithRequestContext } from "../context/index.js";
import { getActiveSession, models, sessionOption, withTransaction } from "../db/index.js";
import { getLogger } from "../logger/index.js";
import { runInOrganizationContext } from "../tenancy/index.js";
import { systemClock } from "../time/index.js";
import {
  followsStream,
  handlesType,
  type EventHandler,
  type EventHandlerRegistry,
} from "./event-handler-registry.js";
import type { EventJobData } from "./event-job.js";
import type { ModuleEffectiveness } from "./module-effectiveness.js";
import {
  advancePosition,
  checkSequence,
  readPosition,
  type StreamPositionKey,
} from "./stream-position.js";
import { OUTBOX_EVENT_MODEL_NAME, type OutboxEventDocument } from "./outbox-event.schema.js";
import {
  PROCESSED_EVENT_MODEL_NAME,
  type ProcessedEventDocument,
} from "./processed-event.schema.js";

/** WAITING_FOR_EARLIER_EVENT: an ORDERED handler got an event whose stream has an earlier, unhandled event (ADR-115). */
export type HandlerRunResult =
  | "HANDLED"
  | "ALREADY_PROCESSED"
  | "SKIPPED_MODULE_OFF"
  | "SKIPPED_NOT_HANDLED"
  | "WAITING_FOR_EARLIER_EVENT";

function toEnvelope(event: OutboxEventDocument): EventEnvelope<EventPayloadMap[EventType]> {
  return {
    eventId: event.eventId,
    type: event.type,
    version: event.version,
    occurredAt: event.occurredAt.toISOString(),
    organizationId: event.organizationId,
    actorUserId: event.actorUserId,
    // Safe: publishEvent stored a payload of this event type's shape, and nothing else writes the outbox.
    payload: event.payload as unknown as EventPayloadMap[EventType],
  };
}

async function loadEvent(eventId: string): Promise<OutboxEventDocument> {
  const event = await models({})
    .get<OutboxEventDocument>(OUTBOX_EVENT_MODEL_NAME)
    .findOne({ eventId })
    .lean<OutboxEventDocument>();
  if (event === null) throw new Error(`outbox event ${eventId} no longer exists`);
  return event;
}

/**
 * Runs `work` as the event's organization, or as a scheduled system job when the event belongs to
 * none (a user-level event). The request ID names the event so every log line of the run is traceable.
 */
function runInEventContext<Result>(
  event: OutboxEventDocument,
  work: () => Promise<Result>,
): Promise<Result> {
  const context = { requestId: `event:${event.eventId}` };
  return runWithRequestContext(context, () =>
    event.organizationId === null
      ? runAsSystem(SYSTEM_REASON.SCHEDULED_JOB, work)
      : runInOrganizationContext(event.organizationId, work),
  );
}

/**
 * Inserts the "this handler did this event" marker. The upsert reports whether the marker is new,
 * so a repeated delivery learns it is a repeat without a failing insert (a failed write would
 * abort the surrounding transaction).
 */
async function recordMarker(key: { eventId: string; handlerKey: string }): Promise<boolean> {
  const result = await models({})
    .get<ProcessedEventDocument>(PROCESSED_EVENT_MODEL_NAME)
    .updateOne(
      key,
      { $setOnInsert: { processedEventId: newId(), processedAt: systemClock.now() } },
      { upsert: true, ...sessionOption(getActiveSession()) },
    );
  return result.upsertedCount > 0;
}

async function runOnce(
  handler: EventHandler,
  event: OutboxEventDocument,
): Promise<HandlerRunResult> {
  return withTransaction(async () => {
    const isFirstTime = await recordMarker({
      eventId: event.eventId,
      handlerKey: handler.handlerKey,
    });
    if (!isFirstTime) return "ALREADY_PROCESSED";
    await handler.handle(toEnvelope(event));
    return "HANDLED";
  });
}

interface OrderedDelivery {
  readonly key: StreamPositionKey;
  readonly streamSequence: number;
}

/** The stream coordinates of an event for an ORDERED handler; undefined for an unordered handler or a keyless event. */
function orderedDeliveryOf(
  handler: EventHandler,
  event: OutboxEventDocument,
): OrderedDelivery | undefined {
  const { orderingKey, streamSequence } = event;
  if (
    handler.ordering === "ORDERED" &&
    orderingKey !== null &&
    !followsStream(handler, orderingKey)
  ) {
    throw new AppError({
      code: ERROR_CODE.INTERNAL,
      messageKey: "errors.event_handler_stream_mismatch",
      details: { handlerKey: handler.handlerKey, orderingKey },
    });
  }
  if (handler.ordering !== "ORDERED" || orderingKey === null || streamSequence === null) {
    return undefined;
  }
  const key = { handlerKey: handler.handlerKey, organizationId: event.organizationId, orderingKey };
  return { key, streamSequence };
}

/**
 * Runs an ORDERED handler on an event of a stream (ADR-115). Only the next event runs; the effect,
 * the processed marker and the position commit in one transaction. An event the handler already
 * passed is a repeat. An event ahead of the position has to wait for the earlier ones. A handler
 * whose module is off still moves the position, so switching a module off never blocks a stream.
 */
async function runOrdered(input: {
  readonly handler: EventHandler;
  readonly event: OutboxEventDocument;
  readonly delivery: OrderedDelivery;
  readonly isAllowed: boolean;
}): Promise<HandlerRunResult> {
  const { handler, event, delivery, isAllowed } = input;
  return withTransaction(async () => {
    const check = checkSequence(await readPosition(delivery.key), delivery.streamSequence);
    if (check === "ALREADY_HANDLED") return "ALREADY_PROCESSED";
    if (check === "AHEAD") return "WAITING_FOR_EARLIER_EVENT";
    if (!handlesType(handler, event.type)) {
      await advancePosition(delivery.key, delivery.streamSequence);
      return "SKIPPED_NOT_HANDLED";
    }
    if (!isAllowed) {
      await advancePosition(delivery.key, delivery.streamSequence);
      return "SKIPPED_MODULE_OFF";
    }
    const isFirstTime = await recordMarker({
      eventId: event.eventId,
      handlerKey: handler.handlerKey,
    });
    if (isFirstTime) await handler.handle(toEnvelope(event));
    await advancePosition(delivery.key, delivery.streamSequence);
    return isFirstTime ? "HANDLED" : "ALREADY_PROCESSED";
  });
}

/**
 * A handler of a module that is off for the event's organization is skipped and its job completes
 * (no marker, no retry). User-level events have no organization, so they always run.
 */
async function isHandlerAllowed(
  handler: EventHandler,
  event: OutboxEventDocument,
  effectiveness: ModuleEffectiveness,
): Promise<boolean> {
  if (event.organizationId === null) return true;
  if (await effectiveness.isEffective(event.organizationId, handler.moduleKey)) return true;
  getLogger().info(
    {
      event: "events.handler_skipped_module_off",
      eventId: event.eventId,
      handlerKey: handler.handlerKey,
      moduleKey: handler.moduleKey,
    },
    "event handler skipped, its module is off",
  );
  return false;
}

/**
 * Runs one handler for one event with exactly-once effect (ADR-090): the marker and the
 * handler's own writes share one transaction, so they commit together or not at all. A failure
 * throws, and the job's retry policy decides what happens next.
 */
export async function runEventHandler(
  data: EventJobData,
  registry: EventHandlerRegistry,
  effectiveness: ModuleEffectiveness,
): Promise<HandlerRunResult> {
  const handler = registry.find(data.handlerKey);
  if (handler === undefined) throw new Error(`no handler registered for ${data.handlerKey}`);
  const event = await loadEvent(data.eventId);
  return runInEventContext(event, async () => {
    const isAllowed = await isHandlerAllowed(handler, event, effectiveness);
    const delivery = orderedDeliveryOf(handler, event);
    if (delivery !== undefined) return runOrdered({ handler, event, delivery, isAllowed });
    if (!isAllowed) return "SKIPPED_MODULE_OFF";
    return runOnce(handler, event);
  });
}

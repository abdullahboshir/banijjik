import {
  SYSTEM_REASON,
  type EventEnvelope,
  type EventPayloadMap,
  type EventType,
} from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { runAsSystem, runWithRequestContext } from "../context/index.js";
import { getActiveSession, models, sessionOption, withTransaction } from "../db/index.js";
import { getLogger } from "../logger/index.js";
import { runInOrganizationContext } from "../tenancy/index.js";
import { systemClock } from "../time/index.js";
import type { EventHandler, EventHandlerRegistry } from "./event-handler-registry.js";
import type { EventJobData } from "./event-job.js";
import type { ModuleEffectiveness } from "./module-effectiveness.js";
import { OUTBOX_EVENT_MODEL_NAME, type OutboxEventDocument } from "./outbox-event.schema.js";
import {
  PROCESSED_EVENT_MODEL_NAME,
  type ProcessedEventDocument,
} from "./processed-event.schema.js";

export type HandlerRunResult = "HANDLED" | "ALREADY_PROCESSED" | "SKIPPED_MODULE_OFF";

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
    if (!(await isHandlerAllowed(handler, event, effectiveness))) return "SKIPPED_MODULE_OFF";
    return runOnce(handler, event);
  });
}

import { models } from "../db/index.js";
import type { EventHandlerRegistry } from "./event-handler-registry.js";
import type { EventJobData } from "./event-job.js";
import { OUTBOX_EVENT_MODEL_NAME, type OutboxEventDocument } from "./outbox-event.schema.js";

/** The stream coordinates of one event for one ORDERED handler. */
export interface EventStreamCoordinates {
  readonly orderingKey: string;
  readonly streamSequence: number;
}

/**
 * Where a job's event sits in its stream when its handler is ORDERED; undefined otherwise or when the
 * event cannot be read (a failure report must never fail because of this lookup).
 */
export async function findStreamOf(
  data: EventJobData,
  registry: EventHandlerRegistry,
): Promise<EventStreamCoordinates | undefined> {
  if (registry.find(data.handlerKey)?.ordering !== "ORDERED") return undefined;
  try {
    const event = await models({})
      .get<OutboxEventDocument>(OUTBOX_EVENT_MODEL_NAME)
      .findOne({ eventId: data.eventId }, { orderingKey: 1, streamSequence: 1 })
      .lean<Pick<OutboxEventDocument, "orderingKey" | "streamSequence">>();
    if (event === null || event.orderingKey === null || event.streamSequence === null) {
      return undefined;
    }
    return { orderingKey: event.orderingKey, streamSequence: event.streamSequence };
  } catch {
    // The dead letter is still written without the stream; the operator sees the handler and the event.
    return undefined;
  }
}

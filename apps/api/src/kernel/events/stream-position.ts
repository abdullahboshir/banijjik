import { newId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../db/index.js";
import {
  EVENT_STREAM_POSITION_MODEL_NAME,
  type EventStreamPositionDocument,
} from "./event-stream.schema.js";

/** Where an event stands against a handler's position in its stream (ADR-115). */
export type SequenceCheck = "NEXT" | "ALREADY_HANDLED" | "AHEAD";

export interface StreamPositionKey {
  readonly handlerKey: string;
  readonly organizationId: string | null;
  readonly orderingKey: string;
}

function positions() {
  return models({}).get<EventStreamPositionDocument>(EVENT_STREAM_POSITION_MODEL_NAME);
}

/** Pure: the event is the next one, one the handler already passed, or one that has to wait for an earlier event. */
export function checkSequence(lastSequence: number, streamSequence: number): SequenceCheck {
  if (streamSequence === lastSequence + 1) return "NEXT";
  return streamSequence <= lastSequence ? "ALREADY_HANDLED" : "AHEAD";
}

/** The last sequence the handler handled in this stream; 0 before the first. Reads inside the active transaction. */
export async function readPosition(key: StreamPositionKey): Promise<number> {
  const position = await positions()
    .findOne(key, null, sessionOption(getActiveSession()))
    .lean<EventStreamPositionDocument>();
  return position?.lastSequence ?? 0;
}

/**
 * Moves the handler's position to `streamSequence`, never backwards. It runs in the same transaction
 * as the handler's effect and the processed marker, so the three commit together or not at all.
 */
export async function advancePosition(
  key: StreamPositionKey,
  streamSequence: number,
): Promise<void> {
  await positions().updateOne(
    key,
    {
      $max: { lastSequence: streamSequence },
      $setOnInsert: { eventStreamPositionId: newId() },
    },
    { upsert: true, ...sessionOption(getActiveSession()) },
  );
}

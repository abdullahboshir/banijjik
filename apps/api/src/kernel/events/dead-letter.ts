import { newId } from "@banijjik/ids";
import { models } from "../db/index.js";
import { reportError } from "../observability/report-error.js";
import { systemClock } from "../time/index.js";
import {
  EVENT_DEAD_LETTER_MODEL_NAME,
  type EventDeadLetterDocument,
} from "./dead-letter.schema.js";
import type { EventJobData } from "./event-job.js";
import { summarizeError } from "./error-summary.js";

export interface FinalFailure {
  readonly data: EventJobData;
  readonly attempts: number;
  readonly error: unknown;
}

async function writeDeadLetter(failure: FinalFailure): Promise<void> {
  const { data, attempts, error } = failure;
  await models({})
    .get<EventDeadLetterDocument>(EVENT_DEAD_LETTER_MODEL_NAME)
    .updateOne(
      { eventId: data.eventId, handlerKey: data.handlerKey },
      {
        $set: {
          type: data.type,
          attempts,
          lastError: summarizeError(error),
          failedAt: systemClock.now(),
        },
        $setOnInsert: { eventDeadLetterId: newId() },
      },
      { upsert: true },
    );
}

/**
 * A handler gave up after its last attempt: report it centrally and keep a dead-letter row for
 * the owner to inspect. Failing to write the row is reported too and never hides the original
 * error. Other handlers of the same event are separate jobs and are not touched.
 */
export async function deadLetter(failure: FinalFailure): Promise<void> {
  const { data, attempts, error } = failure;
  reportError(error, {
    requestId: `event:${data.eventId}`,
    eventId: data.eventId,
    handlerKey: data.handlerKey,
    eventType: data.type,
    attempts,
  });
  try {
    await writeDeadLetter(failure);
  } catch (writeError) {
    reportError(writeError, { eventId: data.eventId, handlerKey: data.handlerKey });
  }
}

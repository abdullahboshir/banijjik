import {
  ERROR_CODE,
  SEQUENCE_KEY_MODE,
  SEQUENCE_MODE,
  type SequenceKey,
} from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import type { ClientSession } from "mongoose";
import { getActiveSession, models, sessionOption } from "../db/index.js";
import { AppError } from "../http/app-error.js";
import { SEQUENCE_MODEL_NAME, type SequenceDocument } from "./sequence.schema.js";

export interface NextSequenceValueOptions {
  readonly organizationId: string;
  readonly sequenceKey: SequenceKey;
}

/**
 * FAST keys run outside the surrounding transaction so concurrent callers never conflict; a
 * number taken by a transaction that aborts is lost (gaps allowed). GAPLESS keys join the
 * transaction and roll back with it, so they need one (ADR-085).
 */
function resolveSession(sequenceKey: SequenceKey): ClientSession | undefined {
  if (SEQUENCE_KEY_MODE[sequenceKey] === SEQUENCE_MODE.FAST) return undefined;
  const session = getActiveSession();
  if (session === undefined) {
    throw new AppError({
      code: ERROR_CODE.INTERNAL,
      messageKey: "errors.gapless_sequence_needs_transaction",
      details: { sequenceKey },
    });
  }
  return session;
}

/**
 * The next document number for an organization. The first call returns 1. Which guarantees it
 * gives (gaps allowed, or gapless) depends on `SEQUENCE_KEY_MODE[sequenceKey]`; see ADR-085.
 * Formatting (prefix, padding, yearly reset) is a settings concern (card 2.4).
 */
export async function nextSequenceValue(options: NextSequenceValueOptions): Promise<number> {
  const { organizationId, sequenceKey } = options;
  const session = resolveSession(sequenceKey);
  const Sequence = models({ organizationId }).get<SequenceDocument>(SEQUENCE_MODEL_NAME);
  const updated = await Sequence.findOneAndUpdate(
    { organizationId, sequenceKey },
    { $inc: { nextValue: 1 }, $setOnInsert: { sequenceId: newId() } },
    { upsert: true, returnDocument: "after", ...sessionOption(session) },
  ).lean<SequenceDocument>();
  if (updated === null) {
    throw new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.sequence_unavailable" });
  }
  return updated.nextValue;
}

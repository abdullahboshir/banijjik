import { ERROR_CODE, type SequenceKey } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../db/index.js";
import { AppError } from "../http/app-error.js";
import { SEQUENCE_MODEL_NAME, type SequenceDocument } from "./sequence.schema.js";

export interface NextSequenceValueOptions {
  readonly organizationId: string;
  readonly sequenceKey: SequenceKey;
}

/**
 * The next document number for an organization: atomic, no gaps while the surrounding
 * transaction commits, and rolled back with it. The first call returns 1. Formatting (prefix,
 * padding, yearly reset) is a settings concern (card 2.4).
 */
export async function nextSequenceValue(options: NextSequenceValueOptions): Promise<number> {
  const { organizationId, sequenceKey } = options;
  const Sequence = models({ organizationId }).get<SequenceDocument>(SEQUENCE_MODEL_NAME);
  const updated = await Sequence.findOneAndUpdate(
    { organizationId, sequenceKey },
    { $inc: { nextValue: 1 }, $setOnInsert: { sequenceId: newId() } },
    { upsert: true, returnDocument: "after", ...sessionOption(getActiveSession()) },
  ).lean<SequenceDocument>();
  if (updated === null) {
    throw new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.sequence_unavailable" });
  }
  return updated.nextValue;
}

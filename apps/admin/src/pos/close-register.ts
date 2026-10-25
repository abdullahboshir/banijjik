import type { CurrencyCode } from "@banijjik/contracts";
import { POS_SESSION_NOTE_MAX_LENGTH } from "@banijjik/contracts/pos";
import type { PosSessionCloseBody } from "@banijjik/validation/pos";
import { moneyFromInput } from "@banijjik/web-client";

export interface CloseFormInput {
  readonly countedText: string;
  readonly noteText: string;
  readonly version: number;
  readonly currency: CurrencyCode;
}

/** A blank note is no note; a note is trimmed and cut at the stored length, never refused. */
function noteOf(noteText: string): string | null {
  const trimmed = noteText.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, POS_SESSION_NOTE_MAX_LENGTH);
}

/**
 * The close request for the counting form, or undefined when the counted cash is not a readable
 * amount. Zero is a valid count (an empty drawer); the variance is computed by the server only.
 */
export function buildCloseBody(input: CloseFormInput): PosSessionCloseBody | undefined {
  const countedCash = moneyFromInput(input.countedText, input.currency);
  if (!countedCash) return undefined;
  return { countedCash, version: input.version, note: noteOf(input.noteText) };
}

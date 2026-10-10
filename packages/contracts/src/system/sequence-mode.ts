import { defineEnum } from "../define-enum.js";
import type { SequenceKey } from "./sequence-key.js";

/**
 * FAST numbers never conflict but may skip a value when a transaction aborts.
 * GAPLESS numbers are rolled back with the transaction and so serialize the callers (ADR-085).
 */
export const SEQUENCE_MODE = defineEnum(["FAST", "GAPLESS"]);

export type SequenceMode = (typeof SEQUENCE_MODE)[keyof typeof SEQUENCE_MODE];

/** Legal numbering (invoices, journals, Z-reports) is gapless; everything else is fast. */
export const SEQUENCE_KEY_MODE: Readonly<Record<SequenceKey, SequenceMode>> = Object.freeze({
  ORDER: SEQUENCE_MODE.FAST,
  BOOKING: SEQUENCE_MODE.FAST,
  ENROLLMENT: SEQUENCE_MODE.FAST,
  PAYMENT: SEQUENCE_MODE.FAST,
  INVOICE: SEQUENCE_MODE.GAPLESS,
  JOURNAL: SEQUENCE_MODE.GAPLESS,
  MEMBER: SEQUENCE_MODE.FAST,
  EXPENSE: SEQUENCE_MODE.FAST,
  TRANSFER: SEQUENCE_MODE.FAST,
  ZREPORT: SEQUENCE_MODE.GAPLESS,
  RETURN: SEQUENCE_MODE.FAST,
});

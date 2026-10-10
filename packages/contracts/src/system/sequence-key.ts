import { defineEnum } from "../define-enum.js";

/** Per-organization document number counters (09-DOMAIN-MODEL section 5.8). */
export const SEQUENCE_KEY = defineEnum([
  "ORDER",
  "BOOKING",
  "ENROLLMENT",
  "PAYMENT",
  "INVOICE",
  "JOURNAL",
  "MEMBER",
  "EXPENSE",
  "TRANSFER",
  "ZREPORT",
  "RETURN",
]);

export type SequenceKey = (typeof SEQUENCE_KEY)[keyof typeof SEQUENCE_KEY];

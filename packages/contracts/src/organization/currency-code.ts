import { defineEnum } from "../define-enum.js";

/** Taka only at launch (ADR-013: money is an integer of minor units plus this code). */
export const CURRENCY_CODE = defineEnum(["BDT"]);

export type CurrencyCode = (typeof CURRENCY_CODE)[keyof typeof CURRENCY_CODE];

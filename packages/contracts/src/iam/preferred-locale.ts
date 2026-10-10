import { defineEnum } from "../define-enum.js";

/** The languages a person can choose for their own account. Bangla is the default (ADR-038). */
export const PREFERRED_LOCALE = defineEnum(["bn", "en"]);

export type PreferredLocale = (typeof PREFERRED_LOCALE)[keyof typeof PREFERRED_LOCALE];

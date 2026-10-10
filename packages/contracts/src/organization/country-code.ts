import { defineEnum } from "../define-enum.js";

/** Bangladesh only at launch. */
export const COUNTRY_CODE = defineEnum(["BD"]);

export type CountryCode = (typeof COUNTRY_CODE)[keyof typeof COUNTRY_CODE];

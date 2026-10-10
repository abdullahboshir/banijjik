import { defineEnum } from "../define-enum.js";

/** Which database a model lives in (ADR-043): identity and configuration, or business records. */
export const DATABASE_KIND = defineEnum(["PLATFORM", "TENANT"]);

export type DatabaseKind = (typeof DATABASE_KIND)[keyof typeof DATABASE_KIND];

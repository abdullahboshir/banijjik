import { defineEnum } from "../define-enum.js";

/** What an organization may do right now, decided by its subscription (10-MODULE-CATALOG section 8, ADR-053). */
export const ACCESS_MODE = defineEnum(["FULL", "READ_ONLY"]);

export type AccessMode = (typeof ACCESS_MODE)[keyof typeof ACCESS_MODE];

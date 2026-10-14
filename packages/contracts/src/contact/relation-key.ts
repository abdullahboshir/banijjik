import { defineEnum } from "../define-enum.js";

/** Relation keys a contact may hold (09 section 5.1). Templates choose a subset. */
export const RELATION_KEY = defineEnum(["GUARDIAN_OF", "PARENT_OF", "EMPLOYEE_OF"]);

export type RelationKey = (typeof RELATION_KEY)[keyof typeof RELATION_KEY];

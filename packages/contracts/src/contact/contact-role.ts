import { defineEnum } from "../define-enum.js";

/** Labels a contact can carry (09 section 5.1). Terms rename them per template ("Patient", "Student"). */
export const CONTACT_ROLE = defineEnum(["CUSTOMER", "SUPPLIER", "LEAD"]);

export type ContactRole = (typeof CONTACT_ROLE)[keyof typeof CONTACT_ROLE];

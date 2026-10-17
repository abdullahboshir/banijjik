import { defineEnum } from "../define-enum.js";

/**
 * Labels a contact can carry (09 section 5.1). Terms rename them per template ("Patient", "Student").
 * RELATED is a person known through another contact: a guardian, parent, emergency contact or relative (ADR-113).
 */
export const CONTACT_ROLE = defineEnum(["CUSTOMER", "SUPPLIER", "LEAD", "RELATED"]);

export type ContactRole = (typeof CONTACT_ROLE)[keyof typeof CONTACT_ROLE];

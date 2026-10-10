import { defineEnum } from "../define-enum.js";

/** What an offering is: a product, a service, a plan, a rental or an event (ADR-031, 11-OFFERINGS-AND-REQUESTS). */
export const OFFERING_KIND = defineEnum(["PRODUCT", "SERVICE", "PLAN", "RENTAL", "EVENT"]);

export type OfferingKind = (typeof OFFERING_KIND)[keyof typeof OFFERING_KIND];

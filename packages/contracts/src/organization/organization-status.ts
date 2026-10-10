import { defineEnum } from "../define-enum.js";

/** SUSPENDED blocks every tenant route (card 1.8); CLOSED organizations are no longer listed. */
export const ORGANIZATION_STATUS = defineEnum(["ACTIVE", "SUSPENDED", "CLOSED"]);

export type OrganizationStatus = (typeof ORGANIZATION_STATUS)[keyof typeof ORGANIZATION_STATUS];

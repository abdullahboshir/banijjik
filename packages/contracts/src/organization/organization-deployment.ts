import { defineEnum } from "../define-enum.js";

/** Where an organization's business data lives (ADR-023): the shared database or a dedicated one. */
export const ORGANIZATION_DEPLOYMENT = defineEnum(["SHARED", "DEDICATED"]);

export type OrganizationDeployment =
  (typeof ORGANIZATION_DEPLOYMENT)[keyof typeof ORGANIZATION_DEPLOYMENT];

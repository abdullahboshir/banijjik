import { defineEnum } from "../define-enum.js";

/**
 * How a stored model relates to organizations (ADR-087). Every model declares one; there is no
 * default, so a new model cannot forget the question.
 * NONE: not owned by an organization (users, sessions, the organization itself).
 * ORGANIZATION: every row belongs to one organization; the tenant plugin filters and stamps it.
 * ORGANIZATION_AND_LOCATION: as above, and rows are also limited to the caller's locations.
 */
export const MODEL_TENANCY = defineEnum(["NONE", "ORGANIZATION", "ORGANIZATION_AND_LOCATION"]);

export type ModelTenancy = (typeof MODEL_TENANCY)[keyof typeof MODEL_TENANCY];

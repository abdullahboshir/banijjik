import type { IndustryTemplateKey } from "./industry-template-key.js";
import type { OrganizationStatus } from "./organization-status.js";

/**
 * `POST /me/orgs` (14-API.md section 4). Country, currency, timezone and locale are set by the
 * server; the package and trial arrive with card 1.6.
 */
export interface OrganizationCreateRequest {
  name: string;
  slug: string;
  industryTemplateKey: IndustryTemplateKey;
  district?: string;
}

/** One row of `GET /me/orgs` and the body of a successful `POST /me/orgs`. */
export interface MyOrganizationSummary {
  organizationId: string;
  slug: string;
  name: string;
  status: OrganizationStatus;
  /** System role keys today; custom role keys join them with card 1.4. */
  roleKeys: string[];
}

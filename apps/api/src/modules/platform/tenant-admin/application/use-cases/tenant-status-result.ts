import { type OrganizationStatus } from "@banijjik/contracts";

export interface TenantStatusResult {
  readonly status: OrganizationStatus;
  readonly version: number;
}

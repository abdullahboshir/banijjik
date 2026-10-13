import { type SubscriptionStatus } from "@banijjik/contracts";
import type { TenantOrganizationView } from "../ports/tenant-admin-ports.js";

export interface TenantSummary {
  readonly organization: TenantOrganizationView;
  readonly subscriptionStatus: SubscriptionStatus | null;
  readonly memberCount: number;
}

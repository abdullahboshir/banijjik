import type { OrganizationId } from "@banijjik/ids";

/**
 * Gives a new organization its trial subscription. Implemented by platform/saas-billing and wired
 * in routes/v1.ts. It runs inside the create transaction, so a failure leaves no organization.
 */
export interface TrialStarter {
  start(organizationId: OrganizationId): Promise<void>;
}

import type { OrganizationId } from "@banijjik/ids";

/**
 * Serializes every create that is checked against a package limit: it writes a counter on the
 * organization, so two concurrent creates conflict and the retry counts again (ADR-092). Call it
 * inside the transaction, before counting.
 */
export interface OrganizationLimitLock {
  acquire(organizationId: OrganizationId): Promise<void>;
}

import type { OrganizationId } from "@banijjik/ids";

/**
 * Runs work as the organization that is being created, with every location. The creator has no
 * membership to look up yet, so the composition root (routes/v1.ts) supplies the kernel's
 * runInOrganizationContext (ADR-087). The module never builds a context itself.
 */
export interface OrganizationContextRunner {
  run<Result>(organizationId: OrganizationId, work: () => Promise<Result>): Promise<Result>;
}

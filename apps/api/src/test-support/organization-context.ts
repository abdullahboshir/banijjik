import { newId } from "@banijjik/ids";
import { runWithRequestContext } from "../kernel/context/index.js";

export interface OrganizationContextOptions {
  /** Defaults to "ALL". */
  readonly allowedLocationIds?: readonly string[] | "ALL";
}

/**
 * Runs `work` as a request of the given organization, the way tenantContext() would set it up.
 * Tests use it to call tenant-scoped models and repositories directly.
 */
export async function withOrganizationContext<Result>(
  organizationId: string,
  work: () => PromiseLike<Result>,
  options: OrganizationContextOptions = {},
): Promise<Result> {
  return runWithRequestContext(
    {
      requestId: newId(),
      organizationId,
      allowedLocationIds: options.allowedLocationIds ?? "ALL",
    },
    // Awaited inside the context: a Mongoose query is a lazy thenable and would otherwise run outside it.
    async () => work(),
  );
}

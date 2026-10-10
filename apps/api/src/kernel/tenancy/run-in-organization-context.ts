import { newId } from "@banijjik/ids";
import {
  findRequestContext,
  runWithRequestContext,
  type RequestContext,
} from "../context/index.js";
import { getLogger } from "../logger/index.js";
import { crossOrganizationAccess } from "./tenant-scope.js";

/**
 * Runs `work` as the given organization with every location. Organization creation uses it: the
 * creator becomes the owner of the organization being created, so there is no membership to look
 * up yet. Only the composition root (routes/v1.ts) may hand it to a module (ADR-087, lint R27).
 */
export async function runInOrganizationContext<Result>(
  organizationId: string,
  work: () => Promise<Result>,
): Promise<Result> {
  const current: RequestContext = findRequestContext() ?? { requestId: newId() };
  // Re-scoping an already scoped request to another organization is never a legitimate step.
  if (current.organizationId !== undefined && current.organizationId !== organizationId) {
    throw crossOrganizationAccess();
  }
  const scoped = { ...current, organizationId, allowedLocationIds: "ALL" as const };
  return runWithRequestContext(scoped, async () => {
    getLogger().info({ event: "tenancy.context_established", organizationId }, "tenant context");
    return work();
  });
}

import { ALL_LOCATIONS, ERROR_CODE, ORGANIZATION_STATUS } from "@banijjik/contracts";
import { uuidV7Schema } from "@banijjik/validation";
import type { RequestHandler } from "express";
import { requireCurrentUserId } from "../auth/require-current-user-id.js";
import { getRequestContext, runWithRequestContext } from "../context/index.js";
import { AppError, notFound } from "../http/app-error.js";
import type { ActiveMembership, MembershipDirectory } from "./membership-directory.js";
import type { AllowedLocations } from "./tenant-scope.js";

export interface TenantContextOptions {
  /** Already wrapped with asSystemPort(AUTH_LOOKUP, ...) by routes/v1.ts: it reads before any organization is set. */
  readonly directory: MembershipDirectory;
}

/** ALL when any assignment covers every location, otherwise the union of the assigned locations. */
export function allowedLocationsOf(membership: ActiveMembership): AllowedLocations {
  const locationIds = membership.assignments.map((assignment) => assignment.locationId);
  if (locationIds.includes(ALL_LOCATIONS)) return ALL_LOCATIONS;
  return [...new Set(locationIds)];
}

function assertOrganizationUsable(membership: ActiveMembership): void {
  if (membership.organizationStatus === ORGANIZATION_STATUS.CLOSED) throw notFound();
  if (membership.organizationStatus === ORGANIZATION_STATUS.SUSPENDED) {
    throw new AppError({ code: ERROR_CODE.ORG_SUSPENDED });
  }
}

/**
 * Resolves `/orgs/:organizationId` for the signed-in user and puts organizationId, memberId and
 * allowedLocationIds into the request context (ADR-022). A missing, malformed, foreign or
 * inactive organization all answer the same 404, so existence is never revealed (ADR-080).
 * Mounted once, in routes/v1.ts, after authenticate().
 * The member and role versions it reads fresh key the permission cache (card 1.4); the membership
 * itself is not cached yet (Redis work, card 1.5).
 */
export function tenantContext(options: TenantContextOptions): RequestHandler {
  return async (request, _response, next) => {
    const parsed = uuidV7Schema.safeParse(request.params["organizationId"]);
    if (!parsed.success) throw notFound();
    const organizationId = parsed.data;
    const membership = await options.directory.findActiveMembership(
      requireCurrentUserId(),
      organizationId,
    );
    if (membership === undefined) throw notFound();
    assertOrganizationUsable(membership);
    const scoped = {
      ...getRequestContext(),
      organizationId,
      memberId: membership.memberId,
      accessVersion: `${membership.memberVersion}.${membership.rolesVersion}`,
      allowedLocationIds: allowedLocationsOf(membership),
    };
    runWithRequestContext(scoped, () => next());
  };
}

import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  invitationCreateRequestSchema,
  invitationIdParamsSchema,
  invitationListQuerySchema,
  locationCreateRequestSchema,
  locationIdParamsSchema,
  locationListQuerySchema,
  locationUpdateRequestSchema,
  memberIdParamsSchema,
  memberListQuerySchema,
  memberUpdateRequestSchema,
  profileUpdateRequestSchema,
  versionedTransitionRequestSchema,
} from "@banijjik/validation";
import { Router, type RequestHandler } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { forbidden, validate } from "../../../../kernel/http/index.js";
import type { InvitationController } from "./invitation.controller.js";
import type { MemberController } from "./member.controller.js";
import type { ProfileAndLocationController } from "./profile-and-location.controller.js";

export interface OrganizationTenantRouterDependencies {
  readonly profileAndLocations: ProfileAndLocationController;
  readonly members: MemberController;
  readonly invitations: InvitationController;
  readonly permission: PermissionMiddlewareFactory;
  /** The `Idempotency-Key` middleware, built once by routes/v1.ts (ADR-089). */
  readonly idempotency: RequestHandler;
}

/**
 * Location writes need the permission at every location (plan 1.7b decision 5): after the
 * permission guard narrowed the request's locations, anything but "ALL" means the caller holds
 * the permission only at some locations, or is assigned to only some.
 */
const requireAllLocations: RequestHandler = (_request, _response, next) => {
  if (getRequestContext().allowedLocationIds !== "ALL") throw forbidden();
  next();
};

function addProfileRoutes(router: Router, input: OrganizationTenantRouterDependencies): void {
  const { profileAndLocations: controller, permission } = input;
  // Any active member may read the profile: no permission key (plan 1.4, 1.7b decision 3).
  router.get("/profile", controller.getProfile);
  router.patch(
    "/profile",
    permission(PERMISSION_KEY.ORGANIZATION_PROFILE_UPDATE),
    validate({ body: profileUpdateRequestSchema }),
    controller.updateProfile,
  );
}

function addLocationRoutes(router: Router, input: OrganizationTenantRouterDependencies): void {
  const { profileAndLocations: controller, permission, idempotency } = input;
  router.get(
    "/locations",
    permission(PERMISSION_KEY.ORGANIZATION_LOCATION_READ),
    validate({ query: locationListQuerySchema }),
    controller.listLocations,
  );
  router.post(
    "/locations",
    permission(PERMISSION_KEY.ORGANIZATION_LOCATION_CREATE),
    requireAllLocations,
    validate({ body: locationCreateRequestSchema }),
    idempotency,
    controller.createLocation,
  );
  router.patch(
    "/locations/:locationId",
    permission(PERMISSION_KEY.ORGANIZATION_LOCATION_UPDATE),
    requireAllLocations,
    validate({ params: locationIdParamsSchema, body: locationUpdateRequestSchema }),
    controller.updateLocation,
  );
  router.post(
    "/locations/:locationId/archive",
    permission(PERMISSION_KEY.ORGANIZATION_LOCATION_ARCHIVE),
    requireAllLocations,
    validate({ params: locationIdParamsSchema, body: versionedTransitionRequestSchema }),
    controller.archiveLocation,
  );
}

function addMemberRoutes(router: Router, input: OrganizationTenantRouterDependencies): void {
  const { members: controller, permission } = input;
  const params = memberIdParamsSchema;
  const transition = { params, body: versionedTransitionRequestSchema };
  router.get(
    "/members",
    permission(PERMISSION_KEY.ORGANIZATION_MEMBER_READ),
    validate({ query: memberListQuerySchema }),
    controller.list,
  );
  router.get(
    "/members/:memberId",
    permission(PERMISSION_KEY.ORGANIZATION_MEMBER_READ),
    validate({ params }),
    controller.get,
  );
  router.patch(
    "/members/:memberId",
    permission(PERMISSION_KEY.ORGANIZATION_MEMBER_UPDATE),
    validate({ params, body: memberUpdateRequestSchema }),
    controller.update,
  );
  router.post(
    "/members/:memberId/suspend",
    permission(PERMISSION_KEY.ORGANIZATION_MEMBER_UPDATE),
    validate(transition),
    controller.transition("SUSPEND"),
  );
  router.post(
    "/members/:memberId/reactivate",
    permission(PERMISSION_KEY.ORGANIZATION_MEMBER_UPDATE),
    validate(transition),
    controller.transition("REACTIVATE"),
  );
  router.post(
    "/members/:memberId/remove",
    permission(PERMISSION_KEY.ORGANIZATION_MEMBER_REMOVE),
    validate(transition),
    controller.transition("REMOVE"),
  );
}

function addInvitationRoutes(router: Router, input: OrganizationTenantRouterDependencies): void {
  const { invitations: controller, permission, idempotency } = input;
  router.get(
    "/invitations",
    permission(PERMISSION_KEY.ORGANIZATION_MEMBER_INVITE),
    validate({ query: invitationListQuerySchema }),
    controller.list,
  );
  router.post(
    "/invitations",
    permission(PERMISSION_KEY.ORGANIZATION_MEMBER_INVITE),
    validate({ body: invitationCreateRequestSchema }),
    idempotency,
    controller.create,
  );
  router.post(
    "/invitations/:invitationId/revoke",
    permission(PERMISSION_KEY.ORGANIZATION_MEMBER_INVITE),
    validate({ params: invitationIdParamsSchema, body: versionedTransitionRequestSchema }),
    controller.revoke,
  );
}

/**
 * Profile, location, member and invitation routes of `/orgs/{organizationId}` (14-API.md
 * section 5.1), mounted behind the tenant pipeline by routes/v1.ts. Each route names its
 * permission; the entitlement gate has already checked that the module is on.
 */
export function buildOrganizationTenantRouter(input: OrganizationTenantRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  addProfileRoutes(router, input);
  addLocationRoutes(router, input);
  addMemberRoutes(router, input);
  addInvitationRoutes(router, input);
  return router;
}

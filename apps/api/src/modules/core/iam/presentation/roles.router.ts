import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  paginationQuerySchema,
  roleArchiveRequestSchema,
  roleCreateRequestSchema,
  roleIdParamsSchema,
  roleUpdateRequestSchema,
} from "@banijjik/validation";
import { Router } from "express";
import {
  requireAllLocations,
  type PermissionMiddlewareFactory,
} from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { RolesController } from "./roles.controller.js";

/**
 * Role endpoints (14-API.md section 5.1), mounted behind the tenant pipeline by routes/v1.ts.
 * Each route names its permission; the middleware also narrows the request's locations (ADR-088).
 * Writes also need the permission at every location: a role is a record of the organization.
 */
export function buildRolesRouter(
  controller: RolesController,
  permission: PermissionMiddlewareFactory,
): Router {
  const router = Router({ mergeParams: true });
  router.get(
    "/roles",
    permission(PERMISSION_KEY.IAM_ROLE_READ),
    validate({ query: paginationQuerySchema }),
    controller.list,
  );
  router.post(
    "/roles",
    permission(PERMISSION_KEY.IAM_ROLE_CREATE),
    requireAllLocations(),
    validate({ body: roleCreateRequestSchema }),
    controller.create,
  );
  router.patch(
    "/roles/:roleId",
    permission(PERMISSION_KEY.IAM_ROLE_UPDATE),
    requireAllLocations(),
    validate({ params: roleIdParamsSchema, body: roleUpdateRequestSchema }),
    controller.update,
  );
  router.post(
    "/roles/:roleId/archive",
    permission(PERMISSION_KEY.IAM_ROLE_ARCHIVE),
    requireAllLocations(),
    validate({ params: roleIdParamsSchema, body: roleArchiveRequestSchema }),
    controller.archive,
  );
  return router;
}

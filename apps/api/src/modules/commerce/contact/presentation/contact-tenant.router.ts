import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  contactAnonymizeRequestSchema,
  contactCreateRequestSchema,
  contactIdParamsSchema,
  contactListQuerySchema,
  contactUpdateRequestSchema,
  versionedTransitionRequestSchema,
} from "@banijjik/validation";
import { Router, type RequestHandler } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { ContactController } from "./contact.controller.js";

export interface ContactTenantRouterDependencies {
  readonly contacts: ContactController;
  readonly permission: PermissionMiddlewareFactory;
  /** The `Idempotency-Key` middleware, built once by routes/v1.ts (ADR-089). */
  readonly idempotency: RequestHandler;
}

/**
 * The contact routes of `/orgs/{organizationId}/contacts` (14-API.md section 5.3), mounted behind
 * the tenant pipeline by routes/v1.ts. Each route names its permission; the entitlement gate has
 * already checked that the module is on. Contacts belong to the organization, so no route needs
 * the permission at every location.
 */
export function buildContactTenantRouter(input: ContactTenantRouterDependencies): Router {
  const { contacts: controller, permission, idempotency } = input;
  const params = contactIdParamsSchema;
  const router = Router({ mergeParams: true });
  router.get(
    "/contacts",
    permission(PERMISSION_KEY.CONTACT_CONTACT_READ),
    validate({ query: contactListQuerySchema }),
    controller.list,
  );
  router.get(
    "/contacts/:contactId",
    permission(PERMISSION_KEY.CONTACT_CONTACT_READ),
    validate({ params }),
    controller.get,
  );
  router.post(
    "/contacts",
    permission(PERMISSION_KEY.CONTACT_CONTACT_CREATE),
    validate({ body: contactCreateRequestSchema }),
    idempotency,
    controller.create,
  );
  router.patch(
    "/contacts/:contactId",
    permission(PERMISSION_KEY.CONTACT_CONTACT_UPDATE),
    validate({ params, body: contactUpdateRequestSchema }),
    controller.update,
  );
  router.post(
    "/contacts/:contactId/archive",
    permission(PERMISSION_KEY.CONTACT_CONTACT_ARCHIVE),
    validate({ params, body: versionedTransitionRequestSchema }),
    controller.archive,
  );
  router.post(
    "/contacts/:contactId/anonymize",
    permission(PERMISSION_KEY.CONTACT_CONTACT_ANONYMIZE),
    validate({ params, body: contactAnonymizeRequestSchema }),
    controller.anonymize,
  );
  return router;
}

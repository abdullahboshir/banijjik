import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  createSiteDomainRequestSchema,
  removeSiteDomainQuerySchema,
  selectCanonicalSiteDomainRequestSchema,
  siteDomainIdParamsSchema,
  siteDomainListQuerySchema,
  verifySiteDomainRequestSchema,
} from "@banijjik/validation/website";
import { Router, type RequestHandler } from "express";
import {
  requireAllLocations,
  type PermissionMiddlewareFactory,
} from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { SiteDomainController } from "./site-domain.controller.js";

export interface SiteDomainRouterDependencies {
  readonly controller: SiteDomainController;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
}

/**
 * Custom-domain routes of `/orgs/{organizationId}/website` (card 4.2 A2). Writes and the list are
 * organization-wide: a location-restricted member is refused before the document is read.
 */
export function buildSiteDomainRouter(input: SiteDomainRouterDependencies): Router {
  const { controller, permission, idempotency } = input;
  const manage = [permission(PERMISSION_KEY.WEBSITE_DOMAIN_MANAGE), requireAllLocations()];
  const router = Router({ mergeParams: true });
  router.get(
    "/website/domains",
    ...manage,
    validate({ query: siteDomainListQuerySchema }),
    controller.list,
  );
  router.post(
    "/website/domains",
    ...manage,
    validate({ body: createSiteDomainRequestSchema }),
    idempotency,
    controller.create,
  );
  router.post(
    "/website/domains/:siteDomainId/verify",
    ...manage,
    validate({ params: siteDomainIdParamsSchema, body: verifySiteDomainRequestSchema }),
    idempotency,
    controller.verify,
  );
  router.delete(
    "/website/domains/:siteDomainId",
    ...manage,
    validate({ params: siteDomainIdParamsSchema, query: removeSiteDomainQuerySchema }),
    idempotency,
    controller.remove,
  );
  router.patch(
    "/website/domains/:siteDomainId",
    ...manage,
    validate({ params: siteDomainIdParamsSchema, body: selectCanonicalSiteDomainRequestSchema }),
    idempotency,
    controller.selectCanonical,
  );
  return router;
}

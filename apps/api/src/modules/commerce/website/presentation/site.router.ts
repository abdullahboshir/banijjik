import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  publishSiteRequestSchema,
  restoreSiteRequestSchema,
  saveSiteDraftRequestSchema,
  siteLayoutPageRequestSchema,
  sitePageIdParamsSchema,
  siteThemeUpdateRequestSchema,
  siteVersionsQuerySchema,
  websiteVersionIdParamsSchema,
} from "@banijjik/validation/website";
import { Router, type RequestHandler } from "express";
import {
  requireAllLocations,
  type PermissionMiddlewareFactory,
} from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { SiteController } from "./site.controller.js";

export interface SiteRouterDependencies {
  readonly controller: SiteController;
  readonly permission: PermissionMiddlewareFactory;
  /** The `Idempotency-Key` middleware, built once by routes/v1.ts (ADR-089). */
  readonly idempotency: RequestHandler;
}

/**
 * The site routes of `/orgs/{organizationId}/website` (card 4.1). A site belongs to the whole
 * organization, so every write additionally needs the permission at every location; a
 * location-restricted staff member is refused before the document is read. Publication commands also
 * take an idempotency key, because a retry must not mint a second revision (decision 15).
 */
function siteWriteGuards(permission: PermissionMiddlewareFactory): {
  readonly read: readonly RequestHandler[];
  readonly update: readonly RequestHandler[];
  readonly publish: readonly RequestHandler[];
} {
  return {
    read: [permission(PERMISSION_KEY.WEBSITE_SITE_READ)],
    update: [permission(PERMISSION_KEY.WEBSITE_SITE_UPDATE), requireAllLocations()],
    publish: [permission(PERMISSION_KEY.WEBSITE_SITE_PUBLISH), requireAllLocations()],
  };
}

function mountPublicationRoutes(
  router: Router,
  input: SiteRouterDependencies,
  guards: ReturnType<typeof siteWriteGuards>,
): void {
  const { controller, idempotency } = input;
  router.post(
    "/website/publish",
    ...guards.publish,
    validate({ body: publishSiteRequestSchema }),
    idempotency,
    controller.publish,
  );
  router.post(
    "/website/unpublish",
    ...guards.publish,
    validate({ body: publishSiteRequestSchema }),
    idempotency,
    controller.unpublish,
  );
  router.get(
    "/website/versions",
    ...guards.read,
    validate({ query: siteVersionsQuerySchema }),
    controller.readVersions,
  );
  router.post(
    "/website/versions/:websiteVersionId/restore",
    ...guards.update,
    validate({ params: websiteVersionIdParamsSchema, body: restoreSiteRequestSchema }),
    idempotency,
    controller.restore,
  );
}

export function buildSiteRouter(input: SiteRouterDependencies): Router {
  const { controller } = input;
  const guards = siteWriteGuards(input.permission);
  const router = Router({ mergeParams: true });
  router.get("/website/site", ...guards.read, controller.readDraft);
  router.patch(
    "/website/site",
    ...guards.update,
    validate({ body: saveSiteDraftRequestSchema }),
    controller.saveDraft,
  );
  router.put(
    "/website/theme",
    ...guards.update,
    validate({ body: siteThemeUpdateRequestSchema }),
    controller.updateTheme,
  );
  router.get("/website/layout-pages", ...guards.read, controller.readPages);
  router.post(
    "/website/layout-pages",
    ...guards.update,
    validate({ body: siteLayoutPageRequestSchema }),
    controller.createPage,
  );
  router.patch(
    "/website/layout-pages/:pageId",
    ...guards.update,
    validate({ params: sitePageIdParamsSchema, body: siteLayoutPageRequestSchema }),
    controller.updatePage,
  );
  mountPublicationRoutes(router, input, guards);
  return router;
}

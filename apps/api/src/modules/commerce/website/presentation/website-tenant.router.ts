import { PERMISSION_KEY } from "@banijjik/contracts";
import { sitePageKeyParamsSchema, sitePageUpsertRequestSchema } from "@banijjik/validation/website";
import { Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { WebsiteController } from "./website.controller.js";

export interface WebsiteTenantRouterDependencies {
  readonly controller: WebsiteController;
  readonly permission: PermissionMiddlewareFactory;
}

/** Admin routes of the website module, mounted under `/orgs/:organizationId` (M.6a decision 1). */
export function buildWebsiteTenantRouter(input: WebsiteTenantRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  const { controller, permission } = input;

  router.get("/website/pages", permission(PERMISSION_KEY.WEBSITE_PAGE_READ), controller.listPages);
  router.put(
    "/website/pages/:pageKey",
    permission(PERMISSION_KEY.WEBSITE_PAGE_UPDATE),
    validate({ params: sitePageKeyParamsSchema, body: sitePageUpsertRequestSchema }),
    controller.upsertPage,
  );
  return router;
}

import { Router, type RequestHandler } from "express";
import { sendData } from "../../../../kernel/http/index.js";
import type { GetPublishedSiteUseCase } from "../application/use-cases/read-site.use-case.js";

/** The published site changes only when it is published, so a shared cache may hold it a minute. */
const PUBLISHED_SITE_CACHE_CONTROL = "public, max-age=60";

export interface SitePublicRouterDependencies {
  readonly requireWebsiteModule: RequestHandler;
  readonly getPublishedSite: GetPublishedSiteUseCase;
}

/**
 * `GET /storefront/orgs/{organizationId}/published-site` (card 4.1): the snapshot the public pointer
 * names, re-projected through the sections that are effective now. The website module must be on, and
 * a business that has never published answers with the same 404 as one that has no site at all.
 */
export function buildSitePublicRouter(input: SitePublicRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  router.get("/published-site", input.requireWebsiteModule, async (_request, response) => {
    const published = await input.getPublishedSite.execute();
    response.set("Cache-Control", PUBLISHED_SITE_CACHE_CONTROL);
    sendData(response, published);
  });
  return router;
}

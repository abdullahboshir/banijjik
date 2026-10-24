import { sitePageKeyParamsSchema } from "@banijjik/validation/website";
import { Router, type RequestHandler } from "express";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { AppError, sendData, validate } from "../../../../kernel/http/index.js";
import { ERROR_CODE } from "@banijjik/contracts";
import type { SitePageKey } from "@banijjik/contracts/website";
import type { GetStorefrontSiteUseCase } from "../application/use-cases/storefront-site.use-case.js";
import type { GetPublishedSitePageUseCase } from "../application/use-cases/site-page.use-cases.js";

/** The site read changes at most once a minute, so shared caches may keep it that long (M.6a decision 2). */
const SITE_CACHE_CONTROL = "public, max-age=60";

export interface WebsiteStorefrontRouterDependencies {
  readonly requireWebsiteModule: RequestHandler;
  readonly getPage: GetPublishedSitePageUseCase;
  readonly getSite: GetStorefrontSiteUseCase;
}

function notAvailable(): AppError {
  return new AppError({
    code: ERROR_CODE.NOT_FOUND,
    messageKey: "errors.storefront_not_available",
  });
}

/**
 * Public routes of the website module, mounted under `/storefront/orgs/:organizationId` (ADR-077).
 * `/site` is answered for every business (it reports the website switch); `/pages/:pageKey` needs
 * the website module on (M.6a decision 1).
 */
export function buildWebsiteStorefrontRouter(input: WebsiteStorefrontRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  router.get("/site", async (_request, response) => {
    const site = await input.getSite.execute(String(getRequestContext().organizationId));
    if (site === undefined) throw notAvailable();
    response.set("Cache-Control", SITE_CACHE_CONTROL);
    sendData(response, site);
  });
  router.get(
    "/pages/:pageKey",
    input.requireWebsiteModule,
    validate({ params: sitePageKeyParamsSchema }),
    async (_request, response) => {
      const { pageKey } = response.locals["validated"].params as { pageKey: SitePageKey };
      sendData(response, await input.getPage.execute(pageKey));
    },
  );
  return router;
}

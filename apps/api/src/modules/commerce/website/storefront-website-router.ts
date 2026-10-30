import { Router, type RequestHandler } from "express";
import { getRequestContext } from "../../../kernel/context/index.js";
import { models } from "../../../kernel/db/index.js";
import { systemClock, type Clock } from "../../../kernel/time/index.js";
import { MongoRateLimiter, type RateLimiter } from "../../../kernel/rate-limit/index.js";
import { WEBSITE_GUEST_CHECKOUT_SETTING_KEY } from "@banijjik/contracts/website";
import type { SiteSectionAvailability } from "./application/ports/site-publication-ports.js";
import type { StorefrontSiteSources } from "./application/ports/website-ports.js";
import { GetStorefrontSiteUseCase } from "./application/use-cases/storefront-site.use-case.js";
import {
  GetPublishedSitePageUseCase,
  ListPublishedSitePagesUseCase,
} from "./application/use-cases/site-page.use-cases.js";
import { GetPublishedSiteUseCase } from "./application/use-cases/read-site.use-case.js";
import { MongoSitePageRepository } from "./infrastructure/mongo-site-page.repository.js";
import { MongoSiteRepository } from "./infrastructure/mongo-site.repository.js";
import { MongoSiteVersionRepository } from "./infrastructure/mongo-site-version.repository.js";
import { MongoWebsiteVersionReader } from "./infrastructure/mongo-website-version.reader.js";
import { buildSitePublicRouter } from "./presentation/site-public.router.js";
import { buildWebsiteStorefrontRouter } from "./presentation/website-storefront.router.js";
import { CreateGuestSessionUseCase } from "./application/use-cases/create-guest-session.use-case.js";
import { ResolveGuestSessionUseCase } from "./application/use-cases/resolve-guest-session.use-case.js";
import { MongoGuestSessionRepository } from "./infrastructure/mongo-guest-session.repository.js";
import { buildGuestSessionRouter } from "./presentation/guest-session.router.js";

export interface PublicOrgSectionReader {
  forOrganization(organizationId: string): Promise<{
    readonly config: { readonly storefrontSections: readonly string[] };
  }>;
}

const publicSectionAvailability = (org: PublicOrgSectionReader): SiteSectionAvailability => ({
  effectiveSectionKeys: async () =>
    (await org.forOrganization(String(getRequestContext().organizationId))).config
      .storefrontSections,
});

export interface WebsiteStorefrontDependencies {
  readonly requireWebsiteModule: RequestHandler;
  readonly siteSources: StorefrontSiteSources;
  readonly orgConfig: PublicOrgSectionReader;
  readonly clock?: Clock;
  readonly limiter?: RateLimiter;
  readonly isProduction?: boolean;
  readonly isGuestCheckoutEnabled?: (organizationId: string) => Promise<boolean>;
}

const isGuestEnabled = async (organizationId: string): Promise<boolean> => {
  const repo = models({}).get<{ value?: unknown }>("SettingValue");
  if (!repo) return true;
  const doc = await repo
    .findOne({ organizationId, settingKey: WEBSITE_GUEST_CHECKOUT_SETTING_KEY, locationId: null })
    .lean<{ value?: unknown }>();
  return doc?.value !== false;
};

export function buildWebsiteStorefrontRouterFor(deps: WebsiteStorefrontDependencies): Router {
  const pages = new MongoSitePageRepository();
  const sites = new MongoSiteRepository();
  const versions = new MongoWebsiteVersionReader();
  const clock = deps.clock ?? systemClock;
  const limiter = deps.limiter ?? new MongoRateLimiter(clock);
  const guestRepo = new MongoGuestSessionRepository();
  return buildWebsiteStorefrontRouter({
    requireWebsiteModule: deps.requireWebsiteModule,
    getPage: new GetPublishedSitePageUseCase(pages, sites, versions),
    getSite: new GetStorefrontSiteUseCase(
      deps.siteSources,
      new ListPublishedSitePagesUseCase(pages, sites, versions),
    ),
  })
    .use(
      buildSitePublicRouter({
        requireWebsiteModule: deps.requireWebsiteModule,
        getPublishedSite: new GetPublishedSiteUseCase({
          sites,
          versions: new MongoSiteVersionRepository(),
          sections: publicSectionAvailability(deps.orgConfig),
        }),
      }),
    )
    .use(
      buildGuestSessionRouter({
        requireWebsiteModule: deps.requireWebsiteModule,
        limiter,
        isProduction: deps.isProduction,
        createGuestSession: new CreateGuestSessionUseCase({
          repository: guestRepo,
          clock,
          isGuestCheckoutEnabled: deps.isGuestCheckoutEnabled ?? isGuestEnabled,
        }),
        resolveGuestSession: new ResolveGuestSessionUseCase(guestRepo, clock),
      }),
    );
}

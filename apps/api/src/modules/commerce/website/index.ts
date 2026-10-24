import type { RequestHandler, Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import { GetStorefrontSiteUseCase } from "./application/use-cases/storefront-site.use-case.js";
import {
  GetPublishedSitePageUseCase,
  ListPublishedSitePagesUseCase,
  ListSitePagesUseCase,
  UpsertSitePageUseCase,
} from "./application/use-cases/site-page.use-cases.js";
import type { StorefrontSiteSources } from "./application/ports/website-ports.js";
import { MongoSitePageRepository } from "./infrastructure/mongo-site-page.repository.js";
import { WebsiteController } from "./presentation/website.controller.js";
import { buildWebsiteStorefrontRouter } from "./presentation/website-storefront.router.js";
import { buildWebsiteTenantRouter } from "./presentation/website-tenant.router.js";

export { websiteManifest } from "./module.manifest.js";
export { registerWebsiteModels } from "./infrastructure/register-website-models.js";
export type { StorefrontSiteSources } from "./application/ports/website-ports.js";
export type {
  StorefrontBusinessProfile,
  StorefrontFeatureFlags,
} from "./application/ports/website-ports.js";

export interface WebsiteAdminDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
}

/** The admin pages of the business (`/orgs/:organizationId/website/pages`). */
export function buildWebsiteAdminRouter(dependencies: WebsiteAdminDependencies): Router {
  const pages = new MongoSitePageRepository();
  const controller = new WebsiteController({
    listPages: new ListSitePagesUseCase(pages),
    upsertPage: new UpsertSitePageUseCase({
      pages,
      unitOfWork: new MongoUnitOfWork(),
      events: kernelEventPublisher,
      audit: dependencies.audit,
      clock: dependencies.clock,
    }),
  });
  return buildWebsiteTenantRouter({ controller, permission: dependencies.permission });
}

export interface WebsiteStorefrontDependencies {
  readonly requireWebsiteModule: RequestHandler;
  readonly siteSources: StorefrontSiteSources;
}

/** The public reads of the business: its site and, while the website is on, its published pages. */
export function buildWebsiteStorefrontRouterFor(
  dependencies: WebsiteStorefrontDependencies,
): Router {
  const pages = new MongoSitePageRepository();
  return buildWebsiteStorefrontRouter({
    requireWebsiteModule: dependencies.requireWebsiteModule,
    getPage: new GetPublishedSitePageUseCase(pages),
    getSite: new GetStorefrontSiteUseCase(
      dependencies.siteSources,
      new ListPublishedSitePagesUseCase(pages),
    ),
  });
}

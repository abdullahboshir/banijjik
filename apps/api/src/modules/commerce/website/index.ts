import { Router, type RequestHandler } from "express";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { getRequestContext } from "../../../kernel/context/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { FileReferenceReader } from "../../core/file/index.js";
import { GetStorefrontSiteUseCase } from "./application/use-cases/storefront-site.use-case.js";
import {
  GetPublishedSitePageUseCase,
  ListPublishedSitePagesUseCase,
  ListSitePagesUseCase,
  UpsertSitePageUseCase,
} from "./application/use-cases/site-page.use-cases.js";
import type { StorefrontSiteSources } from "./application/ports/website-ports.js";
import type { SiteSectionAvailability } from "./application/ports/site-publication-ports.js";
import {
  GetPublishedSiteUseCase,
  GetSiteDraftUseCase,
  ListSiteVersionsUseCase,
} from "./application/use-cases/read-site.use-case.js";
import {
  PublishSiteUseCase,
  UnpublishSiteUseCase,
} from "./application/use-cases/publish-site.use-case.js";
import { RestoreSiteUseCase } from "./application/use-cases/restore-site.use-case.js";
import { SaveSiteDraftUseCase } from "./application/use-cases/save-site.use-case.js";
import {
  CreateSiteLayoutPageUseCase,
  ListSiteLayoutPagesUseCase,
  UpdateSiteLayoutPageUseCase,
  UpdateSiteThemeUseCase,
} from "./application/use-cases/site-layout.use-case.js";
import { MongoSitePageRepository } from "./infrastructure/mongo-site-page.repository.js";
import { MongoSiteRepository } from "./infrastructure/mongo-site.repository.js";
import { MongoSiteVersionRepository } from "./infrastructure/mongo-site-version.repository.js";
import { MongoWebsiteVersionReader } from "./infrastructure/mongo-website-version.reader.js";
import { buildSiteMediaChecker } from "./infrastructure/site-media.checker.js";
import { SiteController } from "./presentation/site.controller.js";
import { buildSitePublicRouter } from "./presentation/site-public.router.js";
import { buildSiteRouter } from "./presentation/site.router.js";
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

/** Only the effective section list is needed here, so the website module names no entitlement type. */
interface OrgSectionReader {
  current(): Promise<{ readonly config: { readonly storefrontSections: readonly string[] } }>;
}

/** The public read has no signed-in organization, so the business of the path is asked by id. */
interface PublicOrgSectionReader {
  forOrganization(organizationId: string): Promise<{
    readonly config: { readonly storefrontSections: readonly string[] };
  }>;
}

function tenantSectionAvailability(orgConfig: OrgSectionReader): SiteSectionAvailability {
  return {
    async effectiveSectionKeys() {
      const effective = await orgConfig.current();
      return effective.config.storefrontSections;
    },
  };
}

function publicSectionAvailability(orgConfig: PublicOrgSectionReader): SiteSectionAvailability {
  return {
    async effectiveSectionKeys() {
      const organizationId = String(getRequestContext().organizationId);
      const effective = await orgConfig.forOrganization(organizationId);
      return effective.config.storefrontSections;
    },
  };
}

export interface WebsiteAdminDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  /** The `Idempotency-Key` middleware, built once by routes/v1.ts (ADR-089). */
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgSectionReader;
  /** The file module's reader, adapted here so a site can only show this business's public images. */
  readonly files: FileReferenceReader;
}

/** The publication dependencies of one request pipeline: the same repositories and one transaction seam. */
function buildPublication(input: {
  readonly sites: MongoSiteRepository;
  readonly versions: MongoSiteVersionRepository;
  readonly images: ReturnType<typeof buildSiteMediaChecker>;
  readonly sections: SiteSectionAvailability;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}) {
  const unitOfWork = new MongoUnitOfWork();
  return {
    sites: input.sites,
    versions: input.versions,
    images: input.images,
    sections: input.sections,
    unitOfWork,
    events: kernelEventPublisher,
    audit: input.audit,
    clock: input.clock,
  };
}

function buildSiteController(dependencies: WebsiteAdminDependencies): SiteController {
  const sites = new MongoSiteRepository();
  const versions = new MongoSiteVersionRepository();
  const sections = tenantSectionAvailability(dependencies.orgConfig);
  const images = buildSiteMediaChecker(dependencies.files);
  const publication = buildPublication({
    sites,
    versions,
    images,
    sections,
    audit: dependencies.audit,
    clock: dependencies.clock,
  });
  const layout = { sites, sections, clock: dependencies.clock };
  return new SiteController({
    getDraft: new GetSiteDraftUseCase(sites),
    saveDraft: new SaveSiteDraftUseCase({ sites, clock: dependencies.clock }),
    listPages: new ListSiteLayoutPagesUseCase({ sites }),
    updateTheme: new UpdateSiteThemeUseCase(layout),
    createPage: new CreateSiteLayoutPageUseCase(layout),
    updatePage: new UpdateSiteLayoutPageUseCase(layout),
    publish: new PublishSiteUseCase(publication),
    unpublish: new UnpublishSiteUseCase(publication),
    listVersions: new ListSiteVersionsUseCase({ sites, versions }),
    restore: new RestoreSiteUseCase(publication),
    sections,
  });
}

/**
 * The admin routes of the business: the legacy static-page bridge (`/website/pages`) and the site
 * document of card 4.1 (`/website/site`, `/theme`, `/layout-pages`, `/publish`, `/versions`).
 */
export function buildWebsiteAdminRouter(dependencies: WebsiteAdminDependencies): Router {
  const pages = new MongoSitePageRepository();
  const sites = new MongoSiteRepository();
  const legacyRouter = buildWebsiteTenantRouter({
    controller: new WebsiteController({
      listPages: new ListSitePagesUseCase(pages, sites),
      upsertPage: new UpsertSitePageUseCase({
        pages,
        sites,
        unitOfWork: new MongoUnitOfWork(),
        events: kernelEventPublisher,
        audit: dependencies.audit,
        clock: dependencies.clock,
      }),
    }),
    permission: dependencies.permission,
  });
  const siteRouter = buildSiteRouter({
    controller: buildSiteController(dependencies),
    permission: dependencies.permission,
    idempotency: dependencies.idempotency,
  });
  const router = Router({ mergeParams: true });
  router.use(legacyRouter);
  router.use(siteRouter);
  return router;
}

export interface WebsiteStorefrontDependencies {
  readonly requireWebsiteModule: RequestHandler;
  readonly siteSources: StorefrontSiteSources;
  readonly orgConfig: PublicOrgSectionReader;
}

/**
 * The public reads of the business: its site and, while the website is on, its published pages and
 * its published design (card 4.1).
 */
export function buildWebsiteStorefrontRouterFor(
  dependencies: WebsiteStorefrontDependencies,
): Router {
  const pages = new MongoSitePageRepository();
  const sites = new MongoSiteRepository();
  const versions = new MongoWebsiteVersionReader();
  const router = buildWebsiteStorefrontRouter({
    requireWebsiteModule: dependencies.requireWebsiteModule,
    getPage: new GetPublishedSitePageUseCase(pages, sites, versions),
    getSite: new GetStorefrontSiteUseCase(
      dependencies.siteSources,
      new ListPublishedSitePagesUseCase(pages, sites, versions),
    ),
  });
  router.use(
    buildSitePublicRouter({
      requireWebsiteModule: dependencies.requireWebsiteModule,
      getPublishedSite: new GetPublishedSiteUseCase({
        sites: new MongoSiteRepository(),
        versions: new MongoSiteVersionRepository(),
        sections: publicSectionAvailability(dependencies.orgConfig),
      }),
    }),
  );
  return router;
}

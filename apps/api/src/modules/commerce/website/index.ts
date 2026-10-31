import { Router, type RequestHandler } from "express";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import { registerScheduledJob } from "../../../kernel/jobs/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import {
  createMongoDomainOperations,
  type DomainProvider,
  type HostClaims,
} from "../../platform/operations/index.js";
import type { FileReferenceReader } from "../../core/file/index.js";
import {
  lookupPublishedStorefrontHost,
  StorefrontHostReader,
} from "./application/storefront-host-reader.js";
import {
  ListSitePagesUseCase,
  UpsertSitePageUseCase,
} from "./application/use-cases/site-page.use-cases.js";
import type { SiteSectionAvailability } from "./application/ports/site-publication-ports.js";
import {
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
import {
  ListSiteDomainsUseCase,
  RemoveSiteDomainUseCase,
  RequestSiteDomainUseCase,
  SelectCanonicalSiteDomainUseCase,
  VerifySiteDomainUseCase,
} from "./application/use-cases/site-domain.use-cases.js";
import {
  buildReconcileDomainsJob,
  ProcessDueSiteDomainsUseCase,
} from "./application/use-cases/process-site-domain.use-case.js";
import { MongoSiteDomainRepository } from "./infrastructure/mongo-site-domain.repository.js";
import { MongoSitePageRepository } from "./infrastructure/mongo-site-page.repository.js";
import { MongoSiteRepository } from "./infrastructure/mongo-site.repository.js";
import { MongoSiteVersionRepository } from "./infrastructure/mongo-site-version.repository.js";
import { buildSiteMediaChecker } from "./infrastructure/site-media.checker.js";
import { SiteDomainController } from "./presentation/site-domain.controller.js";
import { buildSiteDomainRouter } from "./presentation/site-domain.router.js";
import { SiteController } from "./presentation/site.controller.js";
import { buildSiteRouter } from "./presentation/site.router.js";
import { WebsiteController } from "./presentation/website.controller.js";
import { buildWebsiteTenantRouter } from "./presentation/website-tenant.router.js";

export { websiteManifest } from "./module.manifest.js";
export { registerWebsiteModels } from "./infrastructure/register-website-models.js";
export { lookupPublishedStorefrontHost, StorefrontHostReader };
export { MongoSiteRepository } from "./infrastructure/mongo-site.repository.js";
export { SITE_MODEL_NAME, type SiteDocument } from "./infrastructure/site.schema.js";
export {
  CreateGuestSessionUseCase,
  type CreateGuestSessionDependencies,
} from "./application/use-cases/create-guest-session.use-case.js";
export {
  ResolveGuestSessionUseCase,
  hashGuestSecret,
  verifyGuestSecret,
  type ResolveGuestSessionInput,
  type ResolveGuestSessionOutcome,
} from "./application/use-cases/resolve-guest-session.use-case.js";
export { MongoGuestSessionRepository } from "./infrastructure/mongo-guest-session.repository.js";
export type {
  GuestSessionRepository,
  UpdateGuestSessionProvisionalContactInput,
} from "./application/ports/guest-session-repository.port.js";
export {
  buildGuestSessionRouter,
  createGuestSessionAuthMiddleware,
  type GuestSessionRequest,
  type GuestSessionRouterDependencies,
} from "./presentation/guest-session.router.js";
export {
  QuoteCheckoutUseCase,
  formatPrincipalKey,
  computeObjectHash,
  type QuoteCheckoutDependencies,
} from "./application/quote-checkout.js";
export {
  SubmitCheckoutUseCase,
  type SubmitCheckoutDependencies,
} from "./application/submit-checkout.js";
export {
  ReadOwnRequestsUseCase,
  type ReadOwnRequestsDependencies,
  type RequestStatusReaderPort,
  type RequestStatusSnapshot,
} from "./application/read-own-requests.js";
export {
  ClaimCheckoutUseCase,
  type ClaimCheckoutDependencies,
  type ClaimCheckoutInput,
  type CustomerPhoneReaderPort,
} from "./application/claim-checkout.js";
export {
  buildCheckoutRouter,
  createStorefrontPrincipalMiddleware,
  type CheckoutRouterDependencies,
  type CheckoutRequestWithPrincipal,
} from "./presentation/checkout.router.js";
export {
  MongoCheckoutQuoteRepository,
  MongoCheckoutRepository,
  MongoCheckoutAccessRepository,
  MongoCheckoutRequestLinkRepository,
} from "./infrastructure/mongo-checkout.repository.js";
export {
  CHECKOUT_QUOTE_MODEL_NAME,
  CHECKOUT_QUOTE_COLLECTION_NAME,
  type CheckoutQuoteDocument,
} from "./infrastructure/checkout-quote.schema.js";
export {
  CHECKOUT_MODEL_NAME,
  CHECKOUT_COLLECTION_NAME,
  CHECKOUT_REQUEST_LINK_MODEL_NAME,
  CHECKOUT_REQUEST_LINK_COLLECTION_NAME,
  type CheckoutDocument,
  type CheckoutRequestLinkDocument,
} from "./infrastructure/checkout.schema.js";
export {
  CHECKOUT_ACCESS_MODEL_NAME,
  CHECKOUT_ACCESS_COLLECTION_NAME,
  type CheckoutAccessDocument,
} from "./infrastructure/checkout-access.schema.js";
export type {
  CheckoutQuote,
  Checkout,
  CheckoutAccess,
  CheckoutAccessOwner,
  CheckoutRequestLinkRecord,
  CheckoutContactSnapshot,
  CheckoutQuoteInputSnapshot,
  CheckoutPricedSnapshot,
} from "./domain/checkout-types.js";
export type {
  CatalogQuoteReaderPort,
  GuestContactPort,
  OrgStorefrontConfigReader,
  PricedSelectionsResult,
  StorefrontOrganizationConfig,
  CheckoutQuoteRepositoryPort,
  CheckoutRepositoryPort,
  CheckoutAccessRepositoryPort,
  CheckoutRequestLinkRepositoryPort,
} from "./application/checkout-ports.js";
export type {
  StorefrontSiteSources,
  StorefrontBusinessProfile,
  StorefrontFeatureFlags,
} from "./application/ports/website-ports.js";

export const buildStorefrontHostReader = (): StorefrontHostReader =>
  new StorefrontHostReader({
    sites: new MongoSiteRepository(),
    domains: new MongoSiteDomainRepository(),
  });

export function registerWebsiteDomainJobs(input: {
  readonly clock: Clock;
  readonly provider: DomainProvider;
}): void {
  registerScheduledJob(
    buildReconcileDomainsJob({
      useCase: new ProcessDueSiteDomainsUseCase({
        domains: new MongoSiteDomainRepository(),
        sites: new MongoSiteRepository(),
        operations: createMongoDomainOperations(),
        provider: input.provider,
        unitOfWork: new MongoUnitOfWork(),
        events: kernelEventPublisher,
        clock: input.clock,
      }),
    }),
  );
}

interface OrgSectionReader {
  current(): Promise<{ readonly config: { readonly storefrontSections: readonly string[] } }>;
}

const tenantSectionAvailability = (org: OrgSectionReader): SiteSectionAvailability => ({
  effectiveSectionKeys: async () => (await org.current()).config.storefrontSections,
});

export interface WebsiteAdminDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgSectionReader;
  readonly files: FileReferenceReader;
  readonly hostClaims: HostClaims;
}

function buildSiteController(deps: Omit<WebsiteAdminDependencies, "hostClaims">): SiteController {
  const sites = new MongoSiteRepository();
  const versions = new MongoSiteVersionRepository();
  const sections = tenantSectionAvailability(deps.orgConfig);
  const layout = { sites, sections, clock: deps.clock };
  const publication = {
    sites,
    versions,
    images: buildSiteMediaChecker(deps.files),
    sections,
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
    audit: deps.audit,
    clock: deps.clock,
  };
  return new SiteController({
    getDraft: new GetSiteDraftUseCase(sites),
    saveDraft: new SaveSiteDraftUseCase({ sites, clock: deps.clock }),
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

export function buildWebsiteAdminRouter(
  deps: Omit<WebsiteAdminDependencies, "hostClaims"> & { readonly hostClaims?: HostClaims },
): Router {
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
        audit: deps.audit,
        clock: deps.clock,
      }),
    }),
    permission: deps.permission,
  });
  const siteRouter = buildSiteRouter({
    controller: buildSiteController(deps),
    permission: deps.permission,
    idempotency: deps.idempotency,
  });
  const router = Router({ mergeParams: true }).use(legacyRouter).use(siteRouter);
  if (deps.hostClaims !== undefined) {
    router.use(buildWebsiteDomainRouter({ ...deps, hostClaims: deps.hostClaims }));
  }
  return router;
}

export function buildWebsiteDomainRouter(
  deps: Pick<
    WebsiteAdminDependencies,
    "clock" | "audit" | "permission" | "idempotency" | "hostClaims"
  >,
): Router {
  const stack = {
    sites: new MongoSiteRepository(),
    domains: new MongoSiteDomainRepository(),
    hostClaims: deps.hostClaims,
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
    audit: deps.audit,
    clock: deps.clock,
  };
  return buildSiteDomainRouter({
    controller: new SiteDomainController({
      request: new RequestSiteDomainUseCase(stack),
      verify: new VerifySiteDomainUseCase(stack),
      remove: new RemoveSiteDomainUseCase(stack),
      selectCanonical: new SelectCanonicalSiteDomainUseCase(stack),
      list: new ListSiteDomainsUseCase(stack),
    }),
    permission: deps.permission,
    idempotency: deps.idempotency,
  });
}

export {
  buildWebsiteStorefrontRouterFor,
  type WebsiteStorefrontDependencies,
  type PublicOrgSectionReader,
} from "./storefront-website-router.js";

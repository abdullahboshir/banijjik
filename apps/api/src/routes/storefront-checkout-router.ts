import type { ModuleManifest } from "@banijjik/contracts";
import type {
  PublicBookingCommands,
  PublicEnrollmentCommands,
  PublicOrderCommands,
} from "@banijjik/contracts/website";
import type { RequestHandler, Router } from "express";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { MongoUnitOfWork } from "../kernel/db/index.js";
import { kernelEventPublisher } from "../kernel/events/index.js";
import type { RateLimiter } from "../kernel/rate-limit/index.js";
import type { Clock } from "../kernel/time/index.js";
import {
  ClaimCheckoutUseCase,
  MongoCheckoutAccessRepository,
  MongoCheckoutQuoteRepository,
  MongoCheckoutRepository,
  MongoCheckoutRequestLinkRepository,
  MongoGuestSessionRepository,
  QuoteCheckoutUseCase,
  ReadOwnRequestsUseCase,
  ResolveGuestSessionUseCase,
  SubmitCheckoutUseCase,
  buildCheckoutRouter,
  type CatalogQuoteReaderPort,
  type CustomerPhoneReaderPort,
  type GuestContactPort,
  type OrgStorefrontConfigReader,
  type RequestStatusReaderPort,
} from "../modules/commerce/website/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import {
  buildCustomerPhoneReaderAdapter,
  buildGuestContactAdapter,
  buildOrgStorefrontConfigReaderAdapter,
  buildResolveCustomerContactId,
} from "./storefront-checkout-adapters.js";
import { buildStorefrontCommerceCommands } from "./storefront-commerce-commands.js";

export interface StorefrontCheckoutRouterOptions {
  readonly requireWebsiteModule: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly limiter: RateLimiter;
  readonly isProduction?: boolean;
  readonly publicOrders: PublicOrderCommands;
  readonly publicBookings: PublicBookingCommands;
  readonly publicEnrollments: PublicEnrollmentCommands;
  readonly catalogQuoter: CatalogQuoteReaderPort;
  readonly requestStatusReader: RequestStatusReaderPort;
  readonly guestContact?: GuestContactPort;
  readonly customerPhoneReader?: CustomerPhoneReaderPort;
}

function buildCheckoutUseCases(
  options: StorefrontCheckoutRouterOptions,
  repos: {
    readonly quoteRepo: MongoCheckoutQuoteRepository;
    readonly checkoutRepo: MongoCheckoutRepository;
    readonly accessRepo: MongoCheckoutAccessRepository;
    readonly requestLinkRepo: MongoCheckoutRequestLinkRepository;
    readonly unitOfWork: MongoUnitOfWork;
  },
  adapters: {
    readonly resolveGuestSession: ResolveGuestSessionUseCase;
    readonly catalogQuoter: CatalogQuoteReaderPort;
    readonly guestContact: GuestContactPort;
    readonly orgConfigReader: OrgStorefrontConfigReader;
    readonly customerPhoneReader: CustomerPhoneReaderPort;
    readonly requestStatusReader: RequestStatusReaderPort;
  },
) {
  const { publicOrders, publicBookings, publicEnrollments } = options;

  const quoteCheckout = new QuoteCheckoutUseCase({
    catalogQuoter: adapters.catalogQuoter,
    quotes: repos.quoteRepo,
    orgConfig: adapters.orgConfigReader,
    clock: options.clock,
  });

  const submitCheckout = new SubmitCheckoutUseCase({
    quotes: repos.quoteRepo,
    checkouts: repos.checkoutRepo,
    access: repos.accessRepo,
    requestLinks: repos.requestLinkRepo,
    catalogQuoter: adapters.catalogQuoter,
    guestContacts: adapters.guestContact,
    orgConfig: adapters.orgConfigReader,
    publicOrders,
    publicBookings,
    publicEnrollments,
    unitOfWork: repos.unitOfWork,
    events: kernelEventPublisher,
    clock: options.clock,
  });

  const readOwnRequests = new ReadOwnRequestsUseCase({
    access: repos.accessRepo,
    checkouts: repos.checkoutRepo,
    requestLinks: repos.requestLinkRepo,
    requestStatusReader: adapters.requestStatusReader,
    clock: options.clock,
  });

  const claimCheckout = new ClaimCheckoutUseCase({
    access: repos.accessRepo,
    checkouts: repos.checkoutRepo,
    requestLinks: repos.requestLinkRepo,
    resolveGuestSession: adapters.resolveGuestSession,
    customerPhoneReader: adapters.customerPhoneReader,
    unitOfWork: repos.unitOfWork,
    events: kernelEventPublisher,
    clock: options.clock,
  });

  return { quoteCheckout, submitCheckout, readOwnRequests, claimCheckout };
}

export interface StorefrontSurfaceCheckoutInput {
  readonly requireWebsiteModule: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly limiter: RateLimiter;
  readonly isProduction: boolean;
}

export function buildStorefrontSurfaceCheckoutRouter(
  input: StorefrontSurfaceCheckoutInput,
): Router {
  const orgConfigReader = buildOrgStorefrontConfigReaderAdapter(input.orgConfig, input.manifests);
  const commerce = buildStorefrontCommerceCommands({
    clock: input.clock,
    audit: input.audit,
    orgConfig: input.orgConfig,
    manifests: input.manifests,
    orgConfigReader,
  });
  return buildStorefrontCheckoutRouter({
    ...input,
    publicOrders: commerce.publicOrders,
    publicBookings: commerce.publicBookings,
    publicEnrollments: commerce.publicEnrollments,
    catalogQuoter: commerce.catalogQuoter,
    requestStatusReader: commerce.requestStatusReader,
  });
}

export function buildStorefrontCheckoutRouter(options: StorefrontCheckoutRouterOptions): Router {
  const quoteRepo = new MongoCheckoutQuoteRepository();
  const checkoutRepo = new MongoCheckoutRepository();
  const accessRepo = new MongoCheckoutAccessRepository();
  const requestLinkRepo = new MongoCheckoutRequestLinkRepository();
  const guestRepo = new MongoGuestSessionRepository();
  const unitOfWork = new MongoUnitOfWork();

  const resolveGuestSession = new ResolveGuestSessionUseCase(guestRepo, options.clock);
  const catalogQuoter = options.catalogQuoter;
  const guestContact =
    options.guestContact ??
    buildGuestContactAdapter({ audit: options.audit, clock: options.clock });
  const orgConfigReader = buildOrgStorefrontConfigReaderAdapter(
    options.orgConfig,
    options.manifests,
  );
  const customerPhoneReader = options.customerPhoneReader ?? buildCustomerPhoneReaderAdapter();
  const requestStatusReader = options.requestStatusReader;
  const resolveCustomerContactId = buildResolveCustomerContactId();

  const useCases = buildCheckoutUseCases(
    options,
    { quoteRepo, checkoutRepo, accessRepo, requestLinkRepo, unitOfWork },
    {
      resolveGuestSession,
      catalogQuoter,
      guestContact,
      orgConfigReader,
      customerPhoneReader,
      requestStatusReader,
    },
  );

  return buildCheckoutRouter({
    requireWebsiteModule: options.requireWebsiteModule,
    quoteCheckout: useCases.quoteCheckout,
    submitCheckout: useCases.submitCheckout,
    readOwnRequests: useCases.readOwnRequests,
    claimCheckout: useCases.claimCheckout,
    resolveGuestSession,
    resolveCustomerContactId,
    access: accessRepo,
    limiter: options.limiter,
    clock: options.clock,
    ...(options.isProduction !== undefined ? { isProduction: options.isProduction } : {}),
  });
}

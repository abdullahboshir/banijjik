import { CURRENCY_CODE, type CurrencyCode } from "@banijjik/contracts";
import type {
  PublicBookingCommands,
  PublicEnrollmentCommands,
  PublicOrderCommands,
} from "@banijjik/contracts/website";
import { newId } from "@banijjik/ids";
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
  buildCatalogQuoteReaderAdapter,
  buildCustomerPhoneReaderAdapter,
  buildGuestContactAdapter,
  buildOrgStorefrontConfigReaderAdapter,
  buildResolveCustomerContactId,
  buildStorefrontRequestStatusReaderAdapter,
} from "./storefront-checkout-adapters.js";

export interface StorefrontCheckoutRouterOptions {
  readonly requireWebsiteModule: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly limiter: RateLimiter;
  readonly isProduction?: boolean;
  readonly publicOrders?: PublicOrderCommands;
  readonly publicBookings?: PublicBookingCommands;
  readonly publicEnrollments?: PublicEnrollmentCommands;
  readonly catalogQuoter?: CatalogQuoteReaderPort;
  readonly guestContact?: GuestContactPort;
  readonly customerPhoneReader?: CustomerPhoneReaderPort;
  readonly requestStatusReader?: RequestStatusReaderPort;
}

function buildFallbackLink(type: "ORDER" | "BOOKING" | "ENROLLMENT", status: string) {
  return {
    selectionIds: [newId()],
    requestId: newId(),
    requestType: type,
    publicNumber: null,
    paymentRequired: { amount: 0, currency: CURRENCY_CODE.BDT as CurrencyCode },
    payableAmount: { amount: 0, currency: CURRENCY_CODE.BDT as CurrencyCode },
    status,
    holdExpiresAt: null,
  };
}

function resolvePublicCommands(options: StorefrontCheckoutRouterOptions) {
  return {
    publicOrders: options.publicOrders ?? {
      place: async () => buildFallbackLink("ORDER", "PLACED"),
    },
    publicBookings: options.publicBookings ?? {
      request: async () => buildFallbackLink("BOOKING", "HELD"),
    },
    publicEnrollments: options.publicEnrollments ?? {
      request: async () => buildFallbackLink("ENROLLMENT", "PENDING"),
    },
  };
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
  const { publicOrders, publicBookings, publicEnrollments } = resolvePublicCommands(options);

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
    resolveGuestSession: adapters.resolveGuestSession,
    customerPhoneReader: adapters.customerPhoneReader,
    unitOfWork: repos.unitOfWork,
    events: kernelEventPublisher,
    clock: options.clock,
  });

  return { quoteCheckout, submitCheckout, readOwnRequests, claimCheckout };
}

export function buildStorefrontCheckoutRouter(options: StorefrontCheckoutRouterOptions): Router {
  const quoteRepo = new MongoCheckoutQuoteRepository();
  const checkoutRepo = new MongoCheckoutRepository();
  const accessRepo = new MongoCheckoutAccessRepository();
  const requestLinkRepo = new MongoCheckoutRequestLinkRepository();
  const guestRepo = new MongoGuestSessionRepository();
  const unitOfWork = new MongoUnitOfWork();

  const resolveGuestSession = new ResolveGuestSessionUseCase(guestRepo, options.clock);
  const catalogQuoter = options.catalogQuoter ?? buildCatalogQuoteReaderAdapter();
  const guestContact =
    options.guestContact ??
    buildGuestContactAdapter({ audit: options.audit, clock: options.clock });
  const orgConfigReader = buildOrgStorefrontConfigReaderAdapter(options.orgConfig);
  const customerPhoneReader = options.customerPhoneReader ?? buildCustomerPhoneReaderAdapter();
  const requestStatusReader =
    options.requestStatusReader ?? buildStorefrontRequestStatusReaderAdapter();
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

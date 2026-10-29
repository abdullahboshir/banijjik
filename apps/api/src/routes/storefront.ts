import { ERROR_CODE, MODULE_KEY, type ModuleKey, type ModuleManifest } from "@banijjik/contracts";
import { CUSTOMER_LOGIN_SETTING_KEY, CUSTOMER_OTP_RULES } from "@banijjik/contracts/contact";
import {
  storefrontOrganizationParamsSchema,
  storefrontResolveQuerySchema,
} from "@banijjik/validation";
import { Router, type RequestHandler } from "express";
import type { AppConfig } from "../config/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import {
  authenticateCustomer,
  authenticateCustomerOptional,
  cacheAccountStatus,
  createCustomerTokenIssuer,
  createCustomerTokenVerifier,
} from "../kernel/auth/index.js";
import { getRequestContext, runWithRequestContext } from "../kernel/context/index.js";
import { AppError, validate } from "../kernel/http/index.js";
import { rateLimit, type RateLimiter } from "../kernel/rate-limit/index.js";
import { contactFieldsOf } from "./contact-tenant-router.js";
import { runInOrganizationContext } from "../kernel/tenancy/index.js";
import type { Clock } from "../kernel/time/index.js";
import {
  buildContactStorefrontRouterFor,
  buildCustomerAccountStatusReader,
} from "../modules/commerce/contact/index.js";
import {
  buildDirectoryStorefrontRouterFor,
  buildDirectoryErasureParticipantFor,
  buildDirectoryExportParticipantsFor,
} from "../modules/commerce/directory/index.js";
import {
  buildCreditStorefrontRouter,
  buildCreditErasureParticipant,
  buildCreditExportParticipant,
  CancelCreditPurchaseUseCase,
  GetCreditPaymentInfoUseCase,
  GetMyCreditsUseCase,
  GetMyUnlocksUseCase,
  ListActiveCreditPacksUseCase,
  ListMyCreditPurchasesUseCase,
  SubmitCreditPurchaseUseCase,
  UnlockListingUseCase,
} from "../modules/commerce/credit/index.js";
import {
  buildStorefrontOrganizationReader,
  type StorefrontOrganizationReader,
} from "../modules/core/organization/index.js";
import { buildSettingsResolver } from "../modules/core/settings/index.js";
import type { FileModuleDependencies } from "../modules/core/file/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import {
  buildWebsiteStorefrontRouterFor,
  type StorefrontSiteSources,
} from "../modules/commerce/website/index.js";
import { buildCreditModuleDeps } from "./credit-tenant-router.js";
import { buildDirectoryAdapters } from "./directory-storefront-adapters.js";
import { buildStorefrontResolveHandler } from "./storefront-resolve.js";

const RESOLVE_BUCKET = "storefront.resolve.ip";
const SURFACE_BUCKET = "storefront.surface.ip";
const ONE_MINUTE_SECONDS = 60;
// C1 never caches a positive host answer, so every page and same-origin API proxy call hits
// `/resolve` from the storefront server IP. The old 60/min cap assumed a 60s positive cache.
const RESOLVE_PER_MINUTE = 6_000;
const SURFACE_PER_MINUTE = 300;
/** A block must reach a signed-in customer within a minute (ADR-119). */
const ACCOUNT_STATUS_MAX_STALE_SECONDS = 60;

export interface StorefrontRouterInput {
  readonly config: AppConfig;
  readonly clock: Clock;
  readonly rateLimiter: RateLimiter;
  readonly audit: AuditRecorder;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
  /** Tests shorten the account status cache. Production passes none. */
  readonly accountStatusMaxStaleSeconds?: number;
  /** Same overrides as the tenant file module (listing photo uploads on the storefront). */
  readonly fileOverrides?: FileModuleDependencies["overrides"];
}

function notAvailable(): AppError {
  return new AppError({
    code: ERROR_CODE.NOT_FOUND,
    messageKey: "errors.storefront_not_available",
  });
}

/** Checks the business of the path, then runs the rest of the request as that business (tenant context). */
function businessContext(organizations: StorefrontOrganizationReader): RequestHandler {
  return async (request, _response, next) => {
    const organizationId = String(request.params["organizationId"]);
    const organization = await organizations.findActiveById(organizationId);
    if (organization === undefined) throw notAvailable();
    const { configVersion } = organization;
    await runInOrganizationContext(organizationId, async () => {
      // The settings read keys its cache on the config version, as tenantContext() provides it for admin requests.
      runWithRequestContext({ ...getRequestContext(), configVersion }, () => next());
    });
  };
}

/** Customer sign-in is on only when the business switched it on and an SMS driver exists (M.6a decision 2). */
function customerLoginEnabled(
  input: StorefrontRouterInput,
): (organizationId: string) => Promise<boolean> {
  const resolver = buildSettingsResolver({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });
  const hasSmsDriver = input.config.storefront.smsDriver !== "disabled";
  return async (organizationId) => {
    if (!hasSmsDriver) return false;
    const resolved = await resolver.resolve(organizationId, { keys: [CUSTOMER_LOGIN_SETTING_KEY] });
    return resolved.get(CUSTOMER_LOGIN_SETTING_KEY)?.value === true;
  };
}

function customerLoginSwitch(input: StorefrontRouterInput): RequestHandler {
  const isEnabled = customerLoginEnabled(input);
  return async (_request, _response, next) => {
    const { organizationId } = getRequestContext();
    if (organizationId === undefined || !(await isEnabled(organizationId))) throw notAvailable();
    next();
  };
}

function buildCustomerAuth(config: AppConfig, clock: Clock, input: StorefrontRouterInput) {
  const secret = config.auth.accessTokenSecret;
  const accounts = cacheAccountStatus(buildCustomerAccountStatusReader(), {
    clock,
    maxStaleSeconds: input.accountStatusMaxStaleSeconds ?? ACCOUNT_STATUS_MAX_STALE_SECONDS,
  });
  const verifier = createCustomerTokenVerifier({ secret, clock });
  const customerAuth = authenticateCustomer({ verifier, accounts });
  const customerAuthOptional = authenticateCustomerOptional({ verifier, accounts });
  return { customerAuth, customerAuthOptional, secret };
}

/** A storefront route answers 404 while its owner module is off for the business. */
function moduleSwitch(input: StorefrontRouterInput, moduleKey: ModuleKey): RequestHandler {
  return async (_request, _response, next) => {
    const { organizationId } = getRequestContext();
    if (!organizationId || !(await input.orgConfig.isModuleEffective(organizationId, moduleKey))) {
      throw notAvailable();
    }
    next();
  };
}

function creditModuleSwitch(input: StorefrontRouterInput): RequestHandler {
  return moduleSwitch(input, MODULE_KEY.CREDIT);
}

/** The reads behind GET /site: branding from the organization, feature switches from entitlement. */
function buildWebsiteSiteSources(input: StorefrontRouterInput): StorefrontSiteSources {
  const organizations = buildStorefrontOrganizationReader();
  const isCustomerLoginOn = customerLoginEnabled(input);
  const isOn = (organizationId: string, moduleKey: ModuleKey) =>
    input.orgConfig.isModuleEffective(organizationId, moduleKey);
  return {
    readBusiness: (organizationId) => organizations.findActiveById(organizationId),
    readFeatures: async (organizationId) => ({
      directory: await isOn(organizationId, MODULE_KEY.DIRECTORY),
      credit: await isOn(organizationId, MODULE_KEY.CREDIT),
      customerLogin: await isCustomerLoginOn(organizationId),
      website: await isOn(organizationId, MODULE_KEY.WEBSITE),
    }),
  };
}

function buildStorefrontCreditRouter(
  input: StorefrontRouterInput,
  creditDeps: ReturnType<typeof buildCreditModuleDeps>,
  auth: {
    customerAuth: ReturnType<typeof authenticateCustomer>;
    customerAuthOptional: ReturnType<typeof authenticateCustomerOptional>;
  },
) {
  return buildCreditStorefrontRouter({
    requireCreditModule: creditModuleSwitch(input),
    unlockListing: new UnlockListingUseCase(creditDeps),
    getMyCredits: new GetMyCreditsUseCase(creditDeps),
    getMyUnlocks: new GetMyUnlocksUseCase(creditDeps),
    listPacks: new ListActiveCreditPacksUseCase(creditDeps),
    getPaymentInfo: new GetCreditPaymentInfoUseCase(creditDeps),
    submitPurchase: new SubmitCreditPurchaseUseCase(creditDeps),
    listMyPurchases: new ListMyCreditPurchasesUseCase(creditDeps),
    cancelPurchase: new CancelCreditPurchaseUseCase(creditDeps),
    limiter: input.rateLimiter,
    authenticateCustomer: auth.customerAuth,
    authenticateCustomerOptional: auth.customerAuthOptional,
  });
}

function buildStorefrontRouters(
  input: StorefrontRouterInput,
  rateLimiter: RateLimiter,
  auth: {
    customerAuth: ReturnType<typeof authenticateCustomer>;
    customerAuthOptional: ReturnType<typeof authenticateCustomerOptional>;
    secret: string;
  },
) {
  const { config, clock, audit } = input;
  const creditDeps = buildCreditModuleDeps(input);
  const directoryAdapters = buildDirectoryAdapters({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
    clock,
  });

  const directoryRouter = buildDirectoryStorefrontRouterFor({
    requireDirectoryModule: moduleSwitch(input, MODULE_KEY.DIRECTORY),
    clock,
    audit,
    limiter: rateLimiter,
    adapters: directoryAdapters,
    authenticateCustomer: auth.customerAuth,
    authenticateCustomerOptional: auth.customerAuthOptional,
    storage: config.storage,
    ...(input.fileOverrides === undefined ? {} : { fileOverrides: input.fileOverrides }),
  });

  const creditRouter = buildStorefrontCreditRouter(input, creditDeps, auth);

  const contactRouter = buildContactStorefrontRouterFor({
    clock,
    audit,
    limiter: rateLimiter,
    tokens: createCustomerTokenIssuer({
      secret: auth.secret,
      clock,
      ttlSeconds: CUSTOMER_OTP_RULES.accessTokenSeconds,
    }),
    storefront: config.storefront,
    isSecureCookies: config.nodeEnv === "production",
    accessTokenSeconds: CUSTOMER_OTP_RULES.accessTokenSeconds,
    requireCustomerLogin: customerLoginSwitch(input),
    authenticateCustomer: auth.customerAuth,
    contactFields: contactFieldsOf(),
    erasureParticipants: [
      buildDirectoryErasureParticipantFor({ clock, audit, adapters: directoryAdapters }),
      buildCreditErasureParticipant(creditDeps),
    ],
    exportParticipants: [
      ...buildDirectoryExportParticipantsFor({ clock, audit, adapters: directoryAdapters }),
      buildCreditExportParticipant(creditDeps),
    ],
  });

  const websiteRouter = buildWebsiteStorefrontRouterFor({
    requireWebsiteModule: moduleSwitch(input, MODULE_KEY.WEBSITE),
    siteSources: buildWebsiteSiteSources(input),
    // Card 4.1: the published design is re-projected through the sections that are effective now.
    orgConfig: input.orgConfig,
  });

  return { directoryRouter, creditRouter, contactRouter, websiteRouter };
}

function mountOrganizationSurface(
  router: Router,
  input: StorefrontRouterInput,
  organizations: StorefrontOrganizationReader,
): void {
  const { config, clock, rateLimiter } = input;
  const auth = buildCustomerAuth(config, clock, input);
  const { directoryRouter, creditRouter, contactRouter, websiteRouter } = buildStorefrontRouters(
    input,
    rateLimiter,
    auth,
  );

  router.use(
    "/orgs/:organizationId",
    rateLimit({
      limiter: rateLimiter,
      bucket: SURFACE_BUCKET,
      limit: SURFACE_PER_MINUTE,
      windowSeconds: ONE_MINUTE_SECONDS,
    }),
    validate({ params: storefrontOrganizationParamsSchema }),
    businessContext(organizations),
    // Before the contact router, whose customer-login switch guards every path (M.6a: /site must answer).
    websiteRouter,
    directoryRouter,
    creditRouter,
    contactRouter,
  );
}

/**
 * The public storefront API (14-API.md section 6, ADR-077), mounted once by routes/v1.ts. It has its
 * own pipeline: no admin sign-in, no membership. A request names a business in the path; the
 * business must be ACTIVE; the customer's token must be for that business (ADR-119).
 */
export function buildStorefrontRouter(input: StorefrontRouterInput): Router {
  const { rateLimiter } = input;
  const organizations = buildStorefrontOrganizationReader();
  const router = Router();
  router.get(
    "/resolve",
    rateLimit({
      limiter: rateLimiter,
      bucket: RESOLVE_BUCKET,
      limit: RESOLVE_PER_MINUTE,
      windowSeconds: ONE_MINUTE_SECONDS,
    }),
    validate({ query: storefrontResolveQuerySchema }),
    buildStorefrontResolveHandler(input, organizations),
  );
  mountOrganizationSurface(router, input, organizations);
  return router;
}

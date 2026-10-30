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
import { buildCatalogStorefront } from "../modules/commerce/catalog/index.js";
import {
  buildContactStorefrontRouterFor,
  buildCustomerAccountStatusReader,
} from "../modules/commerce/contact/index.js";
import * as directory from "../modules/commerce/directory/index.js";
import * as credit from "../modules/commerce/credit/index.js";
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
const RESOLVE_PER_MINUTE = 6_000;
const SURFACE_PER_MINUTE = 300;
const ACCOUNT_STATUS_MAX_STALE_SECONDS = 60;
const PRIVATE_NO_STORE = "private, no-store";

function storefrontCacheGuard(): RequestHandler {
  return (request, response, next) => {
    response.setHeader("Cache-Control", PRIVATE_NO_STORE);
    const hasCreds = Boolean(request.headers.cookie || request.headers.authorization);
    const originalSet = response.setHeader.bind(response);
    response.setHeader = (name, value) => {
      const lower = name.toLowerCase();
      if (lower === "cache-control" && (hasCreds || response.getHeader("set-cookie"))) {
        return originalSet("Cache-Control", PRIVATE_NO_STORE);
      }
      if (lower === "set-cookie") originalSet("Cache-Control", PRIVATE_NO_STORE);
      return originalSet(name, value);
    };
    next();
  };
}

export interface StorefrontRouterInput {
  readonly config: AppConfig;
  readonly clock: Clock;
  readonly rateLimiter: RateLimiter;
  readonly audit: AuditRecorder;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
  readonly accountStatusMaxStaleSeconds?: number;
  readonly fileOverrides?: FileModuleDependencies["overrides"];
}

function notAvailable(): AppError {
  return new AppError({
    code: ERROR_CODE.NOT_FOUND,
    messageKey: "errors.storefront_not_available",
  });
}

function businessContext(organizations: StorefrontOrganizationReader): RequestHandler {
  return async (request, _response, next) => {
    const organizationId = String(request.params["organizationId"]);
    const organization = await organizations.findActiveById(organizationId);
    if (organization === undefined) throw notAvailable();
    await runInOrganizationContext(organizationId, async () => {
      const ctx = { ...getRequestContext(), configVersion: organization.configVersion };
      runWithRequestContext(ctx, () => next());
    });
  };
}

function customerLoginEnabled(
  input: StorefrontRouterInput,
): (organizationId: string) => Promise<boolean> {
  const resolver = buildSettingsResolver({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });
  const hasSms = input.config.storefront.smsDriver !== "disabled";
  return async (organizationId) => {
    if (!hasSms) return false;
    const res = await resolver.resolve(organizationId, { keys: [CUSTOMER_LOGIN_SETTING_KEY] });
    return res.get(CUSTOMER_LOGIN_SETTING_KEY)?.value === true;
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
  const maxStale = input.accountStatusMaxStaleSeconds ?? ACCOUNT_STATUS_MAX_STALE_SECONDS;
  const accounts = cacheAccountStatus(buildCustomerAccountStatusReader(), {
    clock,
    maxStaleSeconds: maxStale,
  });
  const verifier = createCustomerTokenVerifier({ secret, clock });
  return {
    customerAuth: authenticateCustomer({ verifier, accounts }),
    customerAuthOptional: authenticateCustomerOptional({ verifier, accounts }),
    secret,
  };
}

function moduleSwitch(input: StorefrontRouterInput, moduleKey: ModuleKey): RequestHandler {
  return async (_request, _response, next) => {
    const { organizationId } = getRequestContext();
    if (!organizationId || !(await input.orgConfig.isModuleEffective(organizationId, moduleKey))) {
      throw notAvailable();
    }
    next();
  };
}

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
  return credit.buildCreditStorefrontRouter({
    requireCreditModule: moduleSwitch(input, MODULE_KEY.CREDIT),
    unlockListing: new credit.UnlockListingUseCase(creditDeps),
    getMyCredits: new credit.GetMyCreditsUseCase(creditDeps),
    getMyUnlocks: new credit.GetMyUnlocksUseCase(creditDeps),
    listPacks: new credit.ListActiveCreditPacksUseCase(creditDeps),
    getPaymentInfo: new credit.GetCreditPaymentInfoUseCase(creditDeps),
    submitPurchase: new credit.SubmitCreditPurchaseUseCase(creditDeps),
    listMyPurchases: new credit.ListMyCreditPurchasesUseCase(creditDeps),
    cancelPurchase: new credit.CancelCreditPurchaseUseCase(creditDeps),
    limiter: input.rateLimiter,
    authenticateCustomer: auth.customerAuth,
    authenticateCustomerOptional: auth.customerAuthOptional,
  });
}

function buildStorefrontDirectoryRouter(
  input: StorefrontRouterInput,
  auth: {
    customerAuth: ReturnType<typeof authenticateCustomer>;
    customerAuthOptional: ReturnType<typeof authenticateCustomerOptional>;
  },
  adapters: ReturnType<typeof buildDirectoryAdapters>,
) {
  return directory.buildDirectoryStorefrontRouterFor({
    requireDirectoryModule: moduleSwitch(input, MODULE_KEY.DIRECTORY),
    clock: input.clock,
    audit: input.audit,
    limiter: input.rateLimiter,
    adapters,
    authenticateCustomer: auth.customerAuth,
    authenticateCustomerOptional: auth.customerAuthOptional,
    storage: input.config.storage,
    ...(input.fileOverrides === undefined ? {} : { fileOverrides: input.fileOverrides }),
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
  const directoryRouter = buildStorefrontDirectoryRouter(input, auth, directoryAdapters);
  const creditRouter = buildStorefrontCreditRouter(input, creditDeps, auth);

  const dirErasure = directory.buildDirectoryErasureParticipantFor({
    clock,
    audit,
    adapters: directoryAdapters,
  });
  const dirExport = directory.buildDirectoryExportParticipantsFor({
    clock,
    audit,
    adapters: directoryAdapters,
  });
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
    erasureParticipants: [dirErasure, credit.buildCreditErasureParticipant(creditDeps)],
    exportParticipants: [...dirExport, credit.buildCreditExportParticipant(creditDeps)],
  });

  const websiteRouter = buildWebsiteStorefrontRouterFor({
    requireWebsiteModule: moduleSwitch(input, MODULE_KEY.WEBSITE),
    siteSources: buildWebsiteSiteSources(input),
    orgConfig: input.orgConfig,
  });
  const catalogRouter = buildCatalogStorefront({
    orgConfig: input.orgConfig,
    requireCatalogModule: moduleSwitch(input, MODULE_KEY.CATALOG),
  });
  return { directoryRouter, creditRouter, contactRouter, websiteRouter, catalogRouter };
}

function mountOrganizationSurface(
  router: Router,
  input: StorefrontRouterInput,
  organizations: StorefrontOrganizationReader,
): void {
  const auth = buildCustomerAuth(input.config, input.clock, input);
  const r = buildStorefrontRouters(input, input.rateLimiter, auth);

  router.use(
    "/orgs/:organizationId",
    rateLimit({
      limiter: input.rateLimiter,
      bucket: SURFACE_BUCKET,
      limit: SURFACE_PER_MINUTE,
      windowSeconds: ONE_MINUTE_SECONDS,
    }),
    storefrontCacheGuard(),
    validate({ params: storefrontOrganizationParamsSchema }),
    businessContext(organizations),
    r.websiteRouter,
    r.catalogRouter,
    r.directoryRouter,
    r.creditRouter,
    r.contactRouter,
  );
}

export function buildStorefrontRouter(input: StorefrontRouterInput): Router {
  const organizations = buildStorefrontOrganizationReader();
  const router = Router();
  router.get(
    "/resolve",
    rateLimit({
      limiter: input.rateLimiter,
      bucket: RESOLVE_BUCKET,
      limit: RESOLVE_PER_MINUTE,
      windowSeconds: ONE_MINUTE_SECONDS,
    }),
    validate({ query: storefrontResolveQuerySchema }),
    storefrontCacheGuard(),
    buildStorefrontResolveHandler(input, organizations),
  );
  mountOrganizationSurface(router, input, organizations);
  return router;
}

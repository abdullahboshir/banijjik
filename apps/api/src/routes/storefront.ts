import { ERROR_CODE, type ModuleManifest } from "@banijjik/contracts";
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
import { AppError, sendData, validate } from "../kernel/http/index.js";
import { rateLimit, type RateLimiter } from "../kernel/rate-limit/index.js";
import { runInOrganizationContext } from "../kernel/tenancy/index.js";
import type { Clock } from "../kernel/time/index.js";
import {
  buildContactStorefrontRouterFor,
  buildCustomerAccountLookup,
  buildCustomerAccountStatusReader,
} from "../modules/commerce/contact/index.js";
import { buildDirectoryStorefrontRouterFor } from "../modules/commerce/directory/index.js";
import {
  buildCreditStorefrontRouter,
  MongoCreditRepository,
  MongoCreditPackRepository,
  MongoListingUnlockRepository,
  UnlockListingUseCase,
  GetMyCreditsUseCase,
  GetMyUnlocksUseCase,
  ListActiveCreditPacksUseCase,
} from "../modules/commerce/credit/index.js";
import { MongoUnitOfWork } from "../kernel/db/index.js";
import { kernelEventPublisher } from "../kernel/events/index.js";
import {
  listingFieldsFromEffectiveReader,
  MongoListingRepository,
  type ListingRepository,
} from "../modules/commerce/directory/index.js";
import { directorySettingsFromResolver } from "../modules/commerce/directory/index.js";
import { buildEffectiveCustomFieldReader } from "../modules/core/custom-field/index.js";
import { buildApprovalVerifier } from "../modules/core/iam/index.js";
import {
  buildOrganizationCurrencyReader,
  buildStorefrontOrganizationReader,
  type StorefrontOrganizationReader,
} from "../modules/core/organization/index.js";
import { buildSettingsResolver } from "../modules/core/settings/index.js";
import type { FileModuleDependencies } from "../modules/core/file/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import { buildDirectoryAdapters } from "./directory-storefront-adapters.js";

const RESOLVE_BUCKET = "storefront.resolve.ip";
const SURFACE_BUCKET = "storefront.surface.ip";
const ONE_MINUTE_SECONDS = 60;
const RESOLVE_PER_MINUTE = 60;
const SURFACE_PER_MINUTE = 300;
/** A block must reach a signed-in customer within a minute (ADR-119). */
const ACCOUNT_STATUS_MAX_STALE_SECONDS = 60;

function buildCreditRouterDeps(input: StorefrontRouterInput) {
  const settingsResolver = buildSettingsResolver({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });

  return {
    credit: new MongoCreditRepository(),
    packs: new MongoCreditPackRepository(),
    unlocks: new MongoListingUnlockRepository(),
    listings: new MongoListingRepository() as ListingRepository,
    fields: listingFieldsFromEffectiveReader(buildEffectiveCustomFieldReader()),
    unitOfWork: new MongoUnitOfWork(),
    events: {
      publish: async (
        type: string,
        payload: unknown,
        options?: { version?: number; orderingKey?: string },
      ) => {
        await kernelEventPublisher.publish(
          type as import("@banijjik/contracts").EventType,
          payload as import("@banijjik/contracts").EventPayloadMap[import("@banijjik/contracts").EventType],
          options,
        );
      },
    },
    audit: input.audit,
    clock: input.clock,
    directorySettings: directorySettingsFromResolver(settingsResolver),
    resolveSettings: (oid: string, keys: readonly string[]) =>
      settingsResolver.resolve(oid as import("@banijjik/ids").OrganizationId, { keys }),
    approvals: buildApprovalVerifier({ audit: input.audit, clock: input.clock }),
    accounts: buildCustomerAccountLookup(),
    currency: buildOrganizationCurrencyReader(),
  };
}

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

/** `shop.sites.example.com:3000` under base domain `sites.example.com` is the business slug `shop`. */
export function slugOfHost(host: string, baseDomain: string): string | undefined {
  const hostName = (host.split(":")[0] ?? "").toLowerCase();
  const suffix = `.${baseDomain}`;
  if (!hostName.endsWith(suffix)) return undefined;
  const slug = hostName.slice(0, -suffix.length);
  return slug === "" || slug.includes(".") ? undefined : slug;
}

function buildResolveHandler(
  organizations: StorefrontOrganizationReader,
  baseDomain: string,
): RequestHandler {
  return async (_request, response) => {
    const { host } = response.locals["validated"].query as { host: string };
    const slug = slugOfHost(host, baseDomain);
    const organization =
      slug === undefined ? undefined : await organizations.findActiveBySlug(slug);
    if (organization === undefined) throw notAvailable();
    sendData(response, { organizationId: organization.organizationId });
  };
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

/** Customer sign-in is on only when the business switched it on and an SMS driver exists. */
function customerLoginSwitch(input: StorefrontRouterInput): RequestHandler {
  const resolver = buildSettingsResolver({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });
  const hasSmsDriver = input.config.storefront.smsDriver !== "disabled";
  return async (_request, _response, next) => {
    const { organizationId } = getRequestContext();
    if (!hasSmsDriver || organizationId === undefined) throw notAvailable();
    const resolved = await resolver.resolve(organizationId, { keys: [CUSTOMER_LOGIN_SETTING_KEY] });
    if (resolved.get(CUSTOMER_LOGIN_SETTING_KEY)?.value !== true) throw notAvailable();
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
  const creditDeps = buildCreditRouterDeps(input);

  const directoryRouter = buildDirectoryStorefrontRouterFor({
    clock,
    audit,
    limiter: rateLimiter,
    adapters: buildDirectoryAdapters({
      orgConfig: input.orgConfig,
      manifests: input.manifests,
      clock,
    }),
    authenticateCustomer: auth.customerAuth,
    authenticateCustomerOptional: auth.customerAuthOptional,
    storage: config.storage,
    ...(input.fileOverrides === undefined ? {} : { fileOverrides: input.fileOverrides }),
  });

  const creditRouter = buildCreditStorefrontRouter({
    unlockListing: new UnlockListingUseCase(creditDeps),
    getMyCredits: new GetMyCreditsUseCase(creditDeps),
    getMyUnlocks: new GetMyUnlocksUseCase(creditDeps),
    listPacks: new ListActiveCreditPacksUseCase(creditDeps),
    limiter: rateLimiter,
    authenticateCustomer: auth.customerAuth,
    authenticateCustomerOptional: auth.customerAuthOptional,
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
  });

  return { directoryRouter, creditRouter, contactRouter };
}

function mountOrganizationSurface(
  router: Router,
  input: StorefrontRouterInput,
  organizations: StorefrontOrganizationReader,
): void {
  const { config, clock, rateLimiter } = input;
  const auth = buildCustomerAuth(config, clock, input);
  const { directoryRouter, creditRouter, contactRouter } = buildStorefrontRouters(
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
  const { config, rateLimiter } = input;
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
    buildResolveHandler(organizations, config.storefront.baseDomain),
  );
  mountOrganizationSurface(router, input, organizations);
  return router;
}

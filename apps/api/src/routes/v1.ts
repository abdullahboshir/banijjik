import { SYSTEM_REASON, TOKEN_AUDIENCE, type ModuleManifest } from "@banijjik/contracts";
import { Router, type RequestHandler } from "express";
import type { AppConfig } from "../config/index.js";
import { createEntitlementGate, createPermissionMiddleware } from "../kernel/access/index.js";
import type { PermissionGate, PermissionMiddlewareFactory } from "../kernel/access/index.js";
import {
  authenticate,
  createJoseAccessTokenVerifier,
  requireCurrentUserId,
} from "../kernel/auth/index.js";
import { asSystemPort } from "../kernel/context/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { createIdempotencyMiddleware } from "../kernel/idempotency/index.js";
import type { ModuleRegistry } from "../kernel/modules/index.js";
import { PER_USER_LIMIT, perUserLimit, type RateLimiter } from "../kernel/rate-limit/index.js";
import type { RedisClient } from "../kernel/redis/index.js";
import {
  locationAccess,
  runInOrganizationContext,
  tenantContext,
} from "../kernel/tenancy/index.js";
import type { Clock } from "../kernel/time/index.js";
import {
  buildAuditRecorder,
  buildAuditTenantRouter,
  registerAuditModels,
} from "../modules/core/audit/index.js";
import type { MemberAccessReader, PermissionCatalog } from "../modules/core/iam/index.js";
import {
  buildIamRouters,
  buildIamTenantRouter,
  buildPermissionCache,
  buildPermissionCatalog,
  buildPermissionGate,
  registerIamModels,
} from "../modules/core/iam/index.js";
import {
  buildMemberAccessReader,
  buildMembershipDirectory,
  buildMyOrganizationsReader,
  buildOrganizationRouters,
  buildRolesVersionBumper,
  registerOrganizationModels,
} from "../modules/core/organization/index.js";
import { registerSettingsModels } from "../modules/core/settings/index.js";
import {
  buildEntitlementTenantRouter,
  buildOrgConfigService,
  registerEntitlementModels,
  type IndustryTemplateReader,
  type OrgConfigService,
} from "../modules/platform/entitlement/index.js";
import { registerPackageModels } from "../modules/platform/package/index.js";
import {
  buildIndustryTemplateAvailability,
  buildIndustryTemplateReader,
  buildPublishedIndustryTemplateRouter,
  registerIndustryModels,
} from "../modules/platform/industry/index.js";
import {
  buildTrialStarter,
  registerSaasBillingModels,
} from "../modules/platform/saas-billing/index.js";
import { registerCustomFieldModels } from "../modules/core/custom-field/index.js";
import { registerFileModels } from "../modules/core/file/index.js";
import { buildCoreTenantRouters, type CoreTenantRouters } from "./core-tenant-routers.js";
import { buildOrganizationTenant } from "./organization-tenant-routers.js";
import {
  buildOrganizationConfigPorts,
  buildResolvedConfigSources,
} from "./organization-config-ports.js";
import { buildModuleRegistry } from "./module-registry.js";
import { mountPlatformApi } from "./platform.js";

export interface V1Dependencies {
  readonly config: AppConfig;
  readonly clock: Clock;
  readonly rateLimiter: RateLimiter;
  /**
   * The per-user limiter of the authenticated API, Redis-backed. Present in the API role; without
   * it the per-user limit is not mounted (tests that do not need it).
   */
  readonly userRateLimiter?: RateLimiter;
  /** Present in the API role: the permission cache then shares Redis between instances (ADR-088). */
  readonly redis?: RedisClient;
  /**
   * Extra routers mounted behind the tenant pipeline at /orgs/:organizationId, after the module
   * routers built here. Production passes none; tests pass probe routers.
   */
  readonly tenantRouters?: readonly Router[];
  /** Like `tenantRouters`, for probes that guard their routes with the `permission(key)` middleware. */
  readonly tenantRouterFactories?: readonly ((permission: PermissionMiddlewareFactory) => Router)[];
  /** Probe modules for tests, registered through the same registry (ADR-091). Production passes none. */
  readonly extraManifests?: readonly ModuleManifest[];
  /** Replaces the industry template reader so tests can turn modules off by template (card 1.6b). */
  readonly templateReader?: IndustryTemplateReader;
  /** Tests lower the file quota, shorten the upload timeout or swap the file storage. Production passes none. */
  readonly fileOverrides?: CoreTenantInput["fileOverrides"];
}

type CoreTenantInput = Parameters<typeof buildCoreTenantRouters>[0];

/** Every module registers its models here, before the databases connect (see main.ts). */
export function registerModuleModels(): void {
  registerIamModels();
  registerOrganizationModels();
  registerAuditModels();
  registerPackageModels();
  registerIndustryModels();
  registerSaasBillingModels();
  registerEntitlementModels();
  registerCustomFieldModels();
  registerSettingsModels();
  registerFileModels();
}

/**
 * The only place that mounts module routers and global middleware (AGENTS.md), and the only place
 * that grants a bypass: asSystemPort and runInOrganizationContext are used here and nowhere in
 * modules (ADR-087, lint R27). The permission catalogue, gate and `permission(key)` middleware
 * are built here from the module registry (ADR-088, ADR-091); the entitlement gate sits after
 * locationAccess and before every module router.
 */
export function buildV1Router(dependencies: V1Dependencies): Router {
  const { config, clock } = dependencies;
  const registry = buildModuleRegistry(dependencies.extraManifests);
  const orgConfig = buildResolvedConfigService(dependencies, registry);
  const router = Router();
  const verifier = createJoseAccessTokenVerifier({ secret: config.auth.accessTokenSecret, clock });
  const requireAdminUser = authenticate({ audience: TOKEN_AUDIENCE.ADMIN, verifier });
  // Sign in first, then count the request against that user, before any database work (review M8).
  const adminGuards = [requireAdminUser, ...buildAdminUserLimit(dependencies)];
  const { authRouter, meRouter } = buildIamRouters(dependencies);
  // Built once here: the idempotency middleware and the audit recorder are shared by the modules.
  const audit = buildAuditRecorder(clock);
  const idempotency = createIdempotencyMiddleware({ clock });
  const myOrganizationsRouter = buildMyOrganizationsRouter(dependencies, audit, idempotency);
  const membershipDirectory = asSystemPort(SYSTEM_REASON.AUTH_LOOKUP, buildMembershipDirectory());
  const access = buildAccessParts({ clock, redis: dependencies.redis, registry });
  const organizationTenant = buildOrganizationTenant({
    clock,
    rateLimiter: dependencies.rateLimiter,
    audit,
    idempotency,
    access,
    orgConfig,
    requireUser: requireAdminUser,
  });
  const coreRouters = buildCoreRouters({ dependencies, audit, orgConfig, access, registry });
  // logout-all lives in the auth router but needs a session; the rest of /auth is public.
  router.use("/auth/logout-all", requireAdminUser);
  router.use("/auth", authRouter);
  // More specific path first, so /me/orgs never falls into the /me router.
  router.use("/me/orgs", adminGuards, myOrganizationsRouter);
  router.use("/industry-templates", adminGuards, buildPublishedIndustryTemplateRouter());
  // PUBLIC files are served without a session (logos and product images for websites, ADR-109).
  router.use("/public", coreRouters.publicFileRouter);
  router.use("/me", adminGuards, meRouter);
  // The invitation link: public preview, signed-in accept. Outside the tenant pipeline.
  router.use("/invitations", organizationTenant.invitationLinkRouter);
  mountPlatformApi(router, {
    dependencies,
    verifier,
    registry,
    userRateLimiter: dependencies.userRateLimiter,
  });
  router.use(
    "/orgs/:organizationId",
    adminGuards,
    tenantContext({ directory: membershipDirectory }),
    locationAccess(),
    createEntitlementGate({ registry, config: orgConfig }),
    buildTenantRouter(
      buildTenantRouters({
        dependencies,
        audit,
        orgConfig,
        access,
        registry,
        organizationRouter: organizationTenant.tenantRouter,
        coreRouters,
      }),
    ),
  );
  return router;
}

/** Custom-field, settings and file routers; the file module also yields the public router. */
function buildCoreRouters(input: {
  readonly dependencies: V1Dependencies;
  readonly audit: AuditRecorder;
  readonly orgConfig: OrgConfigService;
  readonly access: AccessParts;
  readonly registry: ModuleRegistry;
}): CoreTenantRouters {
  const { dependencies, access, registry } = input;
  return buildCoreTenantRouters({
    clock: dependencies.clock,
    audit: input.audit,
    permission: access.permission,
    orgConfig: input.orgConfig,
    registry,
    manifests: registry.all(),
    storage: dependencies.config.storage,
    ...(dependencies.fileOverrides === undefined
      ? {}
      : { fileOverrides: dependencies.fileOverrides }),
  });
}

/** Organization creation, including the published-template check and the trial subscription. */
function buildMyOrganizationsRouter(
  dependencies: V1Dependencies,
  audit: AuditRecorder,
  idempotency: RequestHandler,
): Router {
  return buildOrganizationRouters({
    ...dependencies,
    // The creator becomes the owner of the organization being created, so creation runs as it.
    contextRunner: {
      run: (organizationId, work) => runInOrganizationContext(organizationId, work),
    },
    // "My organizations" spans organizations before any is chosen: a deliberate AUTH_LOOKUP.
    myOrganizationsReader: asSystemPort(SYSTEM_REASON.AUTH_LOOKUP, buildMyOrganizationsReader()),
    audit,
    idempotency,
    // The trial subscription is written inside the create-organization transaction (card 1.6a).
    trialStarter: buildTrialStarter(dependencies.clock),
    industryTemplates: buildIndustryTemplateAvailability(),
  }).myOrganizationsRouter;
}

/** The per-user limit of business users: none without a limiter, otherwise one handler. */
function buildAdminUserLimit(dependencies: V1Dependencies): readonly RequestHandler[] {
  const { userRateLimiter, clock } = dependencies;
  if (userRateLimiter === undefined) return [];
  return [
    perUserLimit({
      limiter: userRateLimiter,
      clock,
      ...PER_USER_LIMIT.ADMIN_USER,
      userKeyOf: requireCurrentUserId,
    }),
  ];
}

/** The resolver behind its cache: the entitlement gate and the config endpoint read through it. */
function buildResolvedConfigService(
  dependencies: V1Dependencies,
  registry: ModuleRegistry,
): OrgConfigService {
  return buildOrgConfigService({
    registry,
    clock: dependencies.clock,
    ...buildOrganizationConfigPorts(),
    ...buildResolvedConfigSources(registry),
    templates: dependencies.templateReader ?? buildIndustryTemplateReader(dependencies.clock),
  });
}

interface AccessParts {
  readonly catalog: PermissionCatalog;
  readonly memberAccess: MemberAccessReader;
  readonly permissionGate: PermissionGate;
  readonly permission: PermissionMiddlewareFactory;
}

/** The permission catalogue, gate and `permission(key)` guard, built once from the registry (ADR-088, ADR-091). */
function buildAccessParts(options: {
  readonly clock: Clock;
  readonly redis: RedisClient | undefined;
  readonly registry: ModuleRegistry;
}): AccessParts {
  const { clock, redis, registry } = options;
  const catalog = buildPermissionCatalog(registry.all());
  const memberAccess = buildMemberAccessReader();
  const permissionGate = buildPermissionGate({
    catalog,
    memberAccess,
    clock,
    cache: buildPermissionCache({ clock, ...(redis === undefined ? {} : { redis }) }),
  });
  return {
    catalog,
    memberAccess,
    permissionGate,
    permission: createPermissionMiddleware(permissionGate),
  };
}

interface TenantRoutersInput {
  readonly dependencies: V1Dependencies;
  readonly audit: AuditRecorder;
  readonly orgConfig: OrgConfigService;
  readonly access: AccessParts;
  readonly registry: ModuleRegistry;
  readonly organizationRouter: Router;
  readonly coreRouters: CoreTenantRouters;
}

/**
 * The permission check is a per-route guard (`permission(key)`), built once from the catalogue of
 * every registered manifest. Pipeline order: authenticate, tenantContext, locationAccess,
 * entitlement, permission, validate, controller (01 section 3).
 */
function buildTenantRouters(input: TenantRoutersInput): readonly Router[] {
  const { dependencies, audit, orgConfig, access } = input;
  const { catalog, memberAccess, permissionGate, permission } = access;
  const { clock, tenantRouters = [], tenantRouterFactories = [] } = dependencies;
  const iamRouter = buildIamTenantRouter({
    catalog,
    memberAccess,
    rolesVersion: buildRolesVersionBumper(),
    permission,
    permissions: permissionGate,
    clock,
    audit,
  });
  const auditRouter = buildAuditTenantRouter({ permission });
  const entitlementRouter = buildEntitlementTenantRouter({
    orgConfig,
    permissions: permissionGate,
    permissionDefinitions: catalog.all(),
  });
  const { customFieldRouter, settingsRouter, fileRouter } = input.coreRouters;
  return [
    iamRouter,
    input.organizationRouter,
    auditRouter,
    entitlementRouter,
    customFieldRouter,
    settingsRouter,
    fileRouter,
    ...tenantRouters,
    ...tenantRouterFactories.map((build) => build(permission)),
  ];
}

function buildTenantRouter(tenantRouters: readonly Router[]): Router {
  const tenantRouter = Router({ mergeParams: true });
  for (const moduleRouter of tenantRouters) tenantRouter.use(moduleRouter);
  return tenantRouter;
}

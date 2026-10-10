import { SYSTEM_REASON, TOKEN_AUDIENCE, type ModuleManifest } from "@banijjik/contracts";
import { Router } from "express";
import type { AppConfig } from "../config/index.js";
import { createEntitlementGate, createPermissionMiddleware } from "../kernel/access/index.js";
import type { PermissionMiddlewareFactory } from "../kernel/access/index.js";
import { authenticate, createJoseAccessTokenVerifier } from "../kernel/auth/index.js";
import { asSystemPort } from "../kernel/context/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { createIdempotencyMiddleware } from "../kernel/idempotency/index.js";
import type { ModuleRegistry } from "../kernel/modules/index.js";
import type { RateLimiter } from "../kernel/rate-limit/index.js";
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
  buildOrganizationConfigSource,
  buildOrganizationRouters,
  buildRolesVersionBumper,
  registerOrganizationModels,
} from "../modules/core/organization/index.js";
import {
  buildEntitlementTenantRouter,
  buildOrgConfigService,
  registerEntitlementModels,
  type OrgConfigService,
} from "../modules/platform/entitlement/index.js";
import { registerPackageModels } from "../modules/platform/package/index.js";
import {
  buildTrialStarter,
  registerSaasBillingModels,
} from "../modules/platform/saas-billing/index.js";
import { buildModuleRegistry } from "./module-registry.js";

export interface V1Dependencies {
  readonly config: AppConfig;
  readonly clock: Clock;
  readonly rateLimiter: RateLimiter;
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
}

/** Every module registers its models here, before the databases connect (see main.ts). */
export function registerModuleModels(): void {
  registerIamModels();
  registerOrganizationModels();
  registerAuditModels();
  registerPackageModels();
  registerSaasBillingModels();
  registerEntitlementModels();
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
  const orgConfig = buildOrgConfigService({
    registry,
    clock,
    organizations: buildOrganizationConfigSource(),
  });
  const router = Router();
  const verifier = createJoseAccessTokenVerifier({ secret: config.auth.accessTokenSecret, clock });
  const requireAdminUser = authenticate({ audience: TOKEN_AUDIENCE.ADMIN, verifier });
  const { authRouter, meRouter } = buildIamRouters(dependencies);
  // Built once here: the idempotency middleware and the audit recorder are shared by the modules.
  const audit = buildAuditRecorder(clock);
  const idempotency = createIdempotencyMiddleware({ clock });
  const { myOrganizationsRouter } = buildOrganizationRouters({
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
    trialStarter: buildTrialStarter(clock),
  });
  const membershipDirectory = asSystemPort(SYSTEM_REASON.AUTH_LOOKUP, buildMembershipDirectory());

  // logout-all lives in the auth router but needs a session; the rest of /auth is public.
  router.use("/auth/logout-all", requireAdminUser);
  router.use("/auth", authRouter);
  // More specific path first, so /me/orgs never falls into the /me router.
  router.use("/me/orgs", requireAdminUser, myOrganizationsRouter);
  router.use("/me", requireAdminUser, meRouter);
  router.use(
    "/orgs/:organizationId",
    requireAdminUser,
    tenantContext({ directory: membershipDirectory }),
    locationAccess(),
    createEntitlementGate({ registry, config: orgConfig }),
    buildTenantRouter(buildTenantRouters({ dependencies, audit, registry, orgConfig })),
  );
  return router;
}

interface TenantRoutersInput {
  readonly dependencies: V1Dependencies;
  readonly audit: AuditRecorder;
  readonly registry: ModuleRegistry;
  readonly orgConfig: OrgConfigService;
}

/**
 * The permission check is a per-route guard (`permission(key)`), built once from the catalogue of
 * every registered manifest. Pipeline order: authenticate, tenantContext, locationAccess,
 * entitlement, permission, validate, controller (01 section 3).
 */
function buildTenantRouters(input: TenantRoutersInput): readonly Router[] {
  const { dependencies, audit, registry, orgConfig } = input;
  const { clock, redis, tenantRouters = [], tenantRouterFactories = [] } = dependencies;
  const catalog = buildPermissionCatalog(registry.all());
  const memberAccess = buildMemberAccessReader();
  const permissionGate = buildPermissionGate({
    catalog,
    memberAccess,
    clock,
    cache: buildPermissionCache({ clock, ...(redis === undefined ? {} : { redis }) }),
  });
  const permission = createPermissionMiddleware(permissionGate);
  const iamRouter = buildIamTenantRouter({
    catalog,
    memberAccess,
    rolesVersion: buildRolesVersionBumper(),
    permission,
    clock,
    audit,
  });
  const auditRouter = buildAuditTenantRouter({ permission });
  const entitlementRouter = buildEntitlementTenantRouter({
    orgConfig,
    permissions: permissionGate,
  });
  return [
    iamRouter,
    auditRouter,
    entitlementRouter,
    ...tenantRouters,
    ...tenantRouterFactories.map((build) => build(permission)),
  ];
}

function buildTenantRouter(tenantRouters: readonly Router[]): Router {
  const tenantRouter = Router({ mergeParams: true });
  for (const moduleRouter of tenantRouters) tenantRouter.use(moduleRouter);
  return tenantRouter;
}

import { SYSTEM_REASON, TOKEN_AUDIENCE } from "@banijjik/contracts";
import { Router } from "express";
import type { AppConfig } from "../config/index.js";
import { createPermissionMiddleware } from "../kernel/access/index.js";
import type { PermissionMiddlewareFactory } from "../kernel/access/index.js";
import { authenticate, createJoseAccessTokenVerifier } from "../kernel/auth/index.js";
import { asSystemPort } from "../kernel/context/index.js";
import type { RateLimiter } from "../kernel/rate-limit/index.js";
import {
  locationAccess,
  runInOrganizationContext,
  tenantContext,
} from "../kernel/tenancy/index.js";
import type { Clock } from "../kernel/time/index.js";
import {
  buildIamRouters,
  buildIamTenantRouter,
  buildPermissionCatalog,
  buildPermissionGate,
  iamManifest,
  registerIamModels,
} from "../modules/core/iam/index.js";
import {
  buildMemberAccessReader,
  buildMembershipDirectory,
  buildMyOrganizationsReader,
  buildOrganizationRouters,
  buildRolesVersionBumper,
  organizationManifest,
  registerOrganizationModels,
} from "../modules/core/organization/index.js";

export interface V1Dependencies {
  readonly config: AppConfig;
  readonly clock: Clock;
  readonly rateLimiter: RateLimiter;
  /**
   * Extra routers mounted behind the tenant pipeline at /orgs/:organizationId, after the module
   * routers built here. Production passes none; tests pass probe routers.
   */
  readonly tenantRouters?: readonly Router[];
  /** Like `tenantRouters`, for probes that guard their routes with the `permission(key)` middleware. */
  readonly tenantRouterFactories?: readonly ((permission: PermissionMiddlewareFactory) => Router)[];
}

/** Every module registers its models here, before the databases connect (see main.ts). */
export function registerModuleModels(): void {
  registerIamModels();
  registerOrganizationModels();
}

/**
 * The only place that mounts module routers and global middleware (AGENTS.md), and the only place
 * that grants a bypass: asSystemPort and runInOrganizationContext are used here and nowhere in
 * modules (ADR-087, lint R27). The permission catalogue, gate and `permission(key)` middleware
 * are built here from the manifests (ADR-088); the entitlement middleware joins in card 1.6.
 */
export function buildV1Router(dependencies: V1Dependencies): Router {
  const { config, clock } = dependencies;
  const router = Router();
  const verifier = createJoseAccessTokenVerifier({ secret: config.auth.accessTokenSecret, clock });
  const requireAdminUser = authenticate({ audience: TOKEN_AUDIENCE.ADMIN, verifier });
  const { authRouter, meRouter } = buildIamRouters(dependencies);
  const { myOrganizationsRouter } = buildOrganizationRouters({
    ...dependencies,
    // The creator becomes the owner of the organization being created, so creation runs as it.
    contextRunner: {
      run: (organizationId, work) => runInOrganizationContext(organizationId, work),
    },
    // "My organizations" spans organizations before any is chosen: a deliberate AUTH_LOOKUP.
    myOrganizationsReader: asSystemPort(SYSTEM_REASON.AUTH_LOOKUP, buildMyOrganizationsReader()),
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
    buildTenantRouter(buildTenantRouters(dependencies)),
  );
  return router;
}

/**
 * The permission check is a per-route guard (`permission(key)`), built once from the catalogue of
 * every manifest. Pipeline order: authenticate, tenantContext, locationAccess, (entitlement, 1.6),
 * permission, validate, controller (01 section 3). 1.6 replaces the manifest list with the registry.
 */
function buildTenantRouters(dependencies: V1Dependencies): readonly Router[] {
  const { clock, tenantRouters = [], tenantRouterFactories = [] } = dependencies;
  const catalog = buildPermissionCatalog([iamManifest, organizationManifest]);
  const memberAccess = buildMemberAccessReader();
  const permission = createPermissionMiddleware(
    buildPermissionGate({ catalog, memberAccess, clock }),
  );
  const iamRouter = buildIamTenantRouter({
    catalog,
    memberAccess,
    rolesVersion: buildRolesVersionBumper(),
    permission,
    clock,
  });
  return [iamRouter, ...tenantRouters, ...tenantRouterFactories.map((build) => build(permission))];
}

function buildTenantRouter(tenantRouters: readonly Router[]): Router {
  const tenantRouter = Router({ mergeParams: true });
  for (const moduleRouter of tenantRouters) tenantRouter.use(moduleRouter);
  return tenantRouter;
}

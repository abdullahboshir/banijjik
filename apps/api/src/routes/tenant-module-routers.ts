import { Router } from "express";
import type { PermissionGate, PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import type { ModuleRegistry } from "../kernel/modules/index.js";
import type { RateLimiter } from "../kernel/rate-limit/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildAuditTenantRouter } from "../modules/core/audit/index.js";
import type { MemberAccessReader, PermissionCatalog } from "../modules/core/iam/index.js";
import {
  buildEntitlementTenantRouter,
  type OrgConfigService,
} from "../modules/platform/entitlement/index.js";
import type { CoreTenantRouters } from "./core-tenant-routers.js";
import { buildIamTenantRouterFor } from "./iam-tenant-router.js";

interface AccessParts {
  readonly catalog: PermissionCatalog;
  readonly memberAccess: MemberAccessReader;
  readonly permissionGate: PermissionGate;
  readonly permission: PermissionMiddlewareFactory;
}

export interface TenantRoutersInput {
  readonly dependencies: {
    readonly clock: Clock;
    readonly rateLimiter: RateLimiter;
    readonly tenantRouters?: readonly Router[];
    readonly tenantRouterFactories?: readonly ((
      permission: PermissionMiddlewareFactory,
    ) => Router)[];
  };
  readonly audit: AuditRecorder;
  readonly orgConfig: OrgConfigService;
  readonly access: AccessParts;
  readonly registry: ModuleRegistry;
  readonly organizationRouter: Router;
  readonly coreRouters: CoreTenantRouters;
}

/**
 * Pipeline order: authenticate, tenantContext, locationAccess, entitlement, permission, validate,
 * controller (01 section 3). The permission check is a per-route guard (`permission(key)`).
 */
export function buildTenantRouters(input: TenantRoutersInput): readonly Router[] {
  const { dependencies, audit, orgConfig, access } = input;
  const { catalog, permissionGate, permission } = access;
  const { clock, tenantRouters = [], tenantRouterFactories = [] } = dependencies;
  const iamRouter = buildIamTenantRouterFor({
    access,
    clock,
    audit,
    rateLimiter: dependencies.rateLimiter,
    orgConfig,
    manifests: input.registry.all(),
  });
  const {
    customFieldRouter,
    settingsRouter,
    fileRouter,
    contactRouter,
    catalogRouter,
    pricingRouter,
    accountingRouter,
    expenseRouter,
  } = input.coreRouters;
  return [
    iamRouter,
    input.organizationRouter,
    buildAuditTenantRouter({ permission }),
    buildEntitlementTenantRouter({
      orgConfig,
      permissions: permissionGate,
      permissionDefinitions: catalog.all(),
    }),
    customFieldRouter,
    settingsRouter,
    fileRouter,
    accountingRouter,
    contactRouter,
    catalogRouter,
    pricingRouter,
    expenseRouter,
    ...tenantRouters,
    ...tenantRouterFactories.map((build) => build(permission)),
  ];
}

export function buildTenantRouter(tenantRouters: readonly Router[]): Router {
  const tenantRouter = Router({ mergeParams: true });
  for (const moduleRouter of tenantRouters) tenantRouter.use(moduleRouter);
  return tenantRouter;
}

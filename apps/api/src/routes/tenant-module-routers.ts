import type { AppConfig } from "../config/index.js";
import { buildSmsTenantRouter } from "../modules/integration/sms/index.js";
import { buildSmsDependencies, tenantSmsAudit, buildSmsTestMessage } from "./sms-adapters.js";
import { buildEventSessionRouter } from "../modules/commerce/booking/index.js";
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

export interface AccessParts {
  readonly catalog: PermissionCatalog;
  readonly memberAccess: MemberAccessReader;
  readonly permissionGate: PermissionGate;
  readonly permission: PermissionMiddlewareFactory;
}

export interface TenantRoutersInput {
  readonly dependencies: {
    readonly config: AppConfig;
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

/** The module routers added after the first wave, in the order they joined; probe routers of tests follow. */
function laterModuleRouters(
  coreRouters: CoreTenantRouters,
  probeRouters: readonly Router[],
): readonly Router[] {
  return [
    coreRouters.enrollmentRouter,
    coreRouters.websiteRouter,
    coreRouters.posRouter,
    coreRouters.reportRouter,
    ...probeRouters,
  ];
}

/**
 * Pipeline order: authenticate, tenantContext, locationAccess, entitlement, permission, validate,
 * controller (01 section 3). The permission check is a per-route guard (`permission(key)`).
 */
export function buildTenantRouters(input: TenantRoutersInput): readonly Router[] {
  const { dependencies, audit, orgConfig, access } = input;
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
    inventoryRouter,
    directoryRouter,
    accountingRouter,
    bookkeepingRouter,
    expenseRouter,
    bookingRouter,
    creditRouter,
    paymentRouter,
    commissionRouter,
    salesRouter,
  } = input.coreRouters;
  return [
    iamRouter,
    buildSmsTenantModuleRouter(input, access.permission),
    input.organizationRouter,
    buildAuditTenantRouter({ permission: access.permission }),
    buildEntitlementTenantRouter({
      orgConfig,
      permissions: access.permissionGate,
      permissionDefinitions: access.catalog.all(),
    }),
    customFieldRouter,
    settingsRouter,
    fileRouter,
    accountingRouter,
    bookkeepingRouter,
    contactRouter,
    catalogRouter,
    pricingRouter,
    inventoryRouter,
    directoryRouter,
    expenseRouter,
    buildEventSessionRouter({ clock, permission: access.permission, audit }),
    bookingRouter,
    creditRouter,
    paymentRouter,
    commissionRouter,
    salesRouter,
    ...laterModuleRouters(input.coreRouters, tenantRouters),
    ...tenantRouterFactories.map((build) => build(access.permission)),
  ];
}

function buildSmsTenantModuleRouter(
  input: TenantRoutersInput,
  permission: PermissionMiddlewareFactory,
): Router {
  const { dependencies, orgConfig, registry, audit } = input;
  const { clock } = dependencies;
  return buildSmsTenantRouter({
    ...buildSmsDependencies({
      config: dependencies.config,
      clock,
      orgConfig,
      manifests: registry.all(),
    }),
    permission,
    limiter: dependencies.rateLimiter,
    audit: tenantSmsAudit(audit),
    message: buildSmsTestMessage(false),
  });
}

export function buildTenantRouter(tenantRouters: readonly Router[]): Router {
  const tenantRouter = Router({ mergeParams: true });
  for (const moduleRouter of tenantRouters) tenantRouter.use(moduleRouter);
  return tenantRouter;
}

import type { Router } from "express";
import type { PlatformPermissionMiddlewareFactory } from "../../../kernel/auth/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type {
  OwnerIdentifierReader,
  TenantDirectory,
  TenantLifecycle,
  TenantOverrideReader,
  TenantSubscriptionReader,
} from "./application/ports/tenant-admin-ports.js";
import { GetTenantUseCase } from "./application/use-cases/get-tenant.use-case.js";
import { ListTenantsUseCase } from "./application/use-cases/list-tenants.use-case.js";
import { ReactivateTenantUseCase } from "./application/use-cases/reactivate-tenant.use-case.js";
import { SuspendTenantUseCase } from "./application/use-cases/suspend-tenant.use-case.js";
import { TenantController } from "./presentation/tenant.controller.js";
import { buildTenantRouter } from "./presentation/tenant.router.js";

export { tenantAdminManifest } from "./module.manifest.js";

export interface TenantAdminRouterDependencies {
  readonly clock: Clock;
  readonly permission: PlatformPermissionMiddlewareFactory;
  /** Implemented by core/organization. */
  readonly directory: TenantDirectory;
  readonly lifecycle: TenantLifecycle;
  /** Implemented by platform/saas-billing. */
  readonly subscriptions: TenantSubscriptionReader;
  /** Implemented by platform/entitlement. */
  readonly overrides: TenantOverrideReader;
  /** Implemented by core/iam. */
  readonly identifiers: OwnerIdentifierReader;
}

export type {
  OwnerIdentifierReader,
  TenantDirectory,
  TenantLifecycle,
  TenantOverrideReader,
  TenantSubscriptionReader,
} from "./application/ports/tenant-admin-ports.js";

/** `/platform/organizations`: list, detail, suspend and reactivate. The ports are wired in routes/v1.ts. */
export function buildTenantAdminRouter(dependencies: TenantAdminRouterDependencies): Router {
  const { permission, ...shared } = dependencies;
  const controller = new TenantController({
    listTenants: new ListTenantsUseCase(shared),
    getTenant: new GetTenantUseCase(shared),
    suspendTenant: new SuspendTenantUseCase(shared),
    reactivateTenant: new ReactivateTenantUseCase(shared),
  });
  return buildTenantRouter(controller, permission);
}

import { buildEnrollmentTenantRouter } from "./enrollment-tenant-router.js";
import { buildWebsiteAdminRouter } from "../modules/commerce/website/index.js";
import { buildSmsTenantModuleRouter } from "./sms-adapters.js";
import type { ModuleManifest } from "@banijjik/contracts";
import type { AppConfig } from "../config/index.js";
import type { StorageConfig } from "../config/index.js";
import type { RequestHandler, Router } from "express";
import type { PermissionGate, PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import type { ModuleRegistry } from "../kernel/modules/index.js";
import type { RateLimiter } from "../kernel/rate-limit/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildFileModule, type FileModuleDependencies } from "../modules/core/file/index.js";
import { buildFileReferenceReader } from "../modules/core/file/index.js";
import { buildCustomFieldModule } from "../modules/core/custom-field/index.js";
import {
  buildConfigVersionBumper,
  buildLocationLookup,
  buildOrganizationConfigSource,
} from "../modules/core/organization/index.js";
import {
  buildSettingsTenantRouter,
  type LocationExistence,
} from "../modules/core/settings/index.js";
import { buildIndustryTemplateReader } from "../modules/platform/industry/index.js";
import {
  buildTenantModuleSwitch,
  type OrgConfigService,
} from "../modules/platform/entitlement/index.js";
import { buildAccountingTenantRouter } from "./accounting-tenant-router.js";
import { buildCatalogTenantRouter } from "./catalog-tenant-router.js";
import { buildContactTenantRouter } from "./contact-tenant-router.js";
import { buildExpenseTenantRouter } from "./expense-tenant-router.js";
import { buildPricingTenantRouter } from "./pricing-tenant-router.js";
import { buildInventoryTenantRouter } from "./inventory-tenant-router.js";
import { buildDirectoryTenantRouter } from "./directory-tenant-router.js";
import { buildBookingTenantRouter } from "./booking-tenant-router.js";
import { buildCreditTenantRouter } from "./credit-tenant-router.js";
import { buildCommissionTenantRouter } from "./commission-adapters.js";
import { buildPaymentTenantRouterFor } from "./payment-tenant-router.js";
import { buildBookkeepingTenantRouter } from "./bookkeeping-tenant-router.js";
import { buildSalesTenantRouter } from "./sales-tenant-router.js";
import { buildPosTenantRouter, type PosRouterInput } from "./pos-adapters.js";
import { buildReportTenantRouter } from "./report-tenant-router.js";
import { MODULE_MANIFESTS } from "./module-registry.js";

export interface CoreTenantRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly permissions: Pick<PermissionGate, "locationsWith">;
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly registry: ModuleRegistry;
  readonly manifests: readonly ModuleManifest[];
  readonly rateLimiter: RateLimiter;
  readonly storage: StorageConfig;
  /** The POS pairing secret and cookie flag, read from the config in routes/v1.ts. */
  readonly pos: PosRouterInput["pos"];
  /** The SMS router reads its encryption key and provider base URLs from the config (card M.9). */
  readonly config: AppConfig;
  /** Tests lower the quota, shorten the upload timeout or swap the storage. Production passes none. */
  readonly fileOverrides?: FileModuleDependencies["overrides"];
}

export interface CoreTenantRouters {
  readonly customFieldRouter: Router;
  readonly settingsRouter: Router;
  readonly fileRouter: Router;
  /** PUBLIC files without a session; mounted outside the tenant pipeline by routes/v1.ts. */
  readonly publicFileRouter: Router;
  readonly contactRouter: Router;
  readonly catalogRouter: Router;
  readonly accountingRouter: Router;
  readonly bookkeepingRouter: Router;
  readonly expenseRouter: Router;
  readonly pricingRouter: Router;
  readonly inventoryRouter: Router;
  readonly directoryRouter: Router;
  readonly bookingRouter: Router;
  readonly creditRouter: Router;
  readonly paymentRouter: Router;
  readonly commissionRouter: Router;
  readonly salesRouter: Router;
  readonly enrollmentRouter: Router;
  readonly websiteRouter: Router;
  readonly posRouter: Router;
  readonly reportRouter: Router;
  readonly smsRouter: Router;
}

function buildPlatformCoreRouters(
  input: CoreTenantRouterInput,
): Pick<
  CoreTenantRouters,
  "customFieldRouter" | "settingsRouter" | "fileRouter" | "publicFileRouter"
> {
  const { clock, audit, permission, orgConfig } = input;
  const customFieldRouter = buildCustomFieldModule({
    clock,
    audit,
    permission,
    orgConfig,
    registry: input.registry,
    configVersion: buildConfigVersionBumper(),
    productionManifests: MODULE_MANIFESTS,
  }).router;
  const settingsRouter = buildSettingsTenantRouter({
    permission,
    audit,
    orgConfig,
    configVersion: buildConfigVersionBumper(),
    manifests: input.manifests,
    locations: activeLocationExistence(),
    modules: buildTenantModuleSwitch({
      registry: input.registry,
      clock,
      templates: buildIndustryTemplateReader(clock),
      organizations: buildOrganizationConfigSource(),
      audit,
      configVersion: buildConfigVersionBumper(),
    }),
  });
  const files = buildFileModule({
    clock,
    permission,
    websiteEdit: input.permissions,
    storage: input.storage,
    ...(input.fileOverrides === undefined ? {} : { overrides: input.fileOverrides }),
  });
  return {
    customFieldRouter,
    settingsRouter,
    fileRouter: files.tenantRouter,
    publicFileRouter: files.publicRouter,
  };
}

function buildCommerceTenantRouters(
  input: CoreTenantRouterInput,
): Pick<
  CoreTenantRouters,
  | "contactRouter"
  | "catalogRouter"
  | "pricingRouter"
  | "inventoryRouter"
  | "directoryRouter"
  | "accountingRouter"
  | "bookkeepingRouter"
  | "expenseRouter"
  | "bookingRouter"
  | "enrollmentRouter"
  | "websiteRouter"
  | "creditRouter"
  | "paymentRouter"
  | "commissionRouter"
  | "salesRouter"
  | "posRouter"
  | "reportRouter"
> {
  const shared = {
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
    permissions: input.permissions,
    idempotency: input.idempotency,
    orgConfig: input.orgConfig,
    manifests: input.manifests,
    rateLimiter: input.rateLimiter,
  };
  return {
    contactRouter: buildContactTenantRouter(shared),
    catalogRouter: buildCatalogTenantRouter(shared),
    pricingRouter: buildPricingTenantRouter(shared),
    inventoryRouter: buildInventoryTenantRouter({ ...shared, rateLimiter: input.rateLimiter }),
    directoryRouter: buildDirectoryTenantRouter(shared),
    accountingRouter: buildAccountingTenantRouter({
      clock: input.clock,
      audit: input.audit,
      permission: input.permission,
    }),
    bookkeepingRouter: buildBookkeepingTenantRouter(shared),
    expenseRouter: buildExpenseTenantRouter(shared),
    bookingRouter: buildBookingTenantRouter(shared),
    creditRouter: buildCreditTenantRouter(shared),
    paymentRouter: buildPaymentTenantRouterFor(shared),
    commissionRouter: buildCommissionTenantRouter(shared),
    salesRouter: buildSalesTenantRouter(shared),
    posRouter: buildPosTenantRouter({ ...shared, pos: input.pos }),
    reportRouter: buildReportTenantRouter(shared),
    enrollmentRouter: buildEnrollmentTenantRouter(shared),
    websiteRouter: websiteAdminRouterOf(input),
  };
}

/** Site writes are organization-wide and check public images through the file module (4.1). */
function websiteAdminRouterOf(input: CoreTenantRouterInput): Router {
  return buildWebsiteAdminRouter({
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
    idempotency: input.idempotency,
    orgConfig: input.orgConfig,
    files: buildFileReferenceReader(),
  });
}

/** Routers of the `integration/*` modules (card M.9 on). */
function buildIntegrationTenantRouters(
  input: CoreTenantRouterInput,
): Pick<CoreTenantRouters, "smsRouter"> {
  return {
    smsRouter: buildSmsTenantModuleRouter({
      config: input.config,
      clock: input.clock,
      orgConfig: input.orgConfig,
      manifests: input.manifests,
      permission: input.permission,
      rateLimiter: input.rateLimiter,
      audit: input.audit,
    }),
  };
}

/** Custom-field, settings, file and commerce routers (cards 2.3–3.8c). */
export function buildCoreTenantRouters(input: CoreTenantRouterInput): CoreTenantRouters {
  return {
    ...buildPlatformCoreRouters(input),
    ...buildCommerceTenantRouters(input),
    ...buildIntegrationTenantRouters(input),
  };
}

/** Organization owns the Location model. Settings only asks whether the location is ACTIVE. */
function activeLocationExistence(): LocationExistence {
  const locations = buildLocationLookup();
  return {
    exists: (locationId) => locations.isActiveLocation(locationId),
  };
}

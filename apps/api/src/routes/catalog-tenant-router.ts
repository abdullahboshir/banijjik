import {
  CUSTOM_FIELD_ENTITY_TYPE,
  ERROR_CODE,
  PERMISSION_KEY,
  type ModuleManifest,
} from "@banijjik/contracts";
import {
  UNIT_KEY,
  CATALOG_DEFAULT_STOCK_TRACKED_SETTING_KEY,
  CATALOG_DEFAULT_UNIT_SETTING_KEY,
  isUnitKey,
  type UnitKey,
} from "@banijjik/contracts/catalog";
import { buildInventoryCatalogPorts } from "../modules/commerce/inventory/index.js";
import { FILE_PURPOSE } from "@banijjik/contracts/file";
import type { OrganizationId } from "@banijjik/ids";
import type { RequestHandler, Router } from "express";
import type {
  LimitGuard,
  PermissionGate,
  PermissionMiddlewareFactory,
} from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { AppError } from "../kernel/http/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildCatalogRouter } from "../modules/commerce/catalog/index.js";
import type {
  CatalogCustomFieldReader,
  DefaultUnitReader,
  OfferingImageChecker,
  OrganizationCatalogContext,
  SensitiveValueAccess,
} from "../modules/commerce/catalog/index.js";
import { buildEffectiveCustomFieldReader } from "../modules/core/custom-field/index.js";
import { buildFileReferenceReader } from "../modules/core/file/index.js";
import {
  buildLocationLookup,
  buildOrganizationCurrencyReader,
} from "../modules/core/organization/index.js";
import { buildSettingsResolver } from "../modules/core/settings/index.js";
import { buildLimitGuard, type OrgConfigService } from "../modules/platform/entitlement/index.js";

export interface CatalogRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly permissions: Pick<PermissionGate, "locationsWith">;
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
}

/** The currency from the organization, and the kinds its template and package allow from the resolved config. */
function organizationContextOf(orgConfig: OrgConfigService): OrganizationCatalogContext {
  const currencies = buildOrganizationCurrencyReader();
  return {
    read: async (organizationId) => {
      const [currency, effective] = await Promise.all([
        currencies.read(organizationId),
        orgConfig.forOrganization(organizationId),
      ]);
      // A tenant request always has an organization; a missing currency is a data fault, not a client error.
      if (currency === undefined) {
        throw new AppError({
          code: ERROR_CODE.INTERNAL,
          messageKey: "errors.missing_tenant_context",
        });
      }
      return { currency, kinds: effective.config.kinds };
    },
  };
}

/** Adapts the custom-field engine to the catalog port: catalog never imports it directly. */
function customFieldsOf(): CatalogCustomFieldReader {
  const reader = buildEffectiveCustomFieldReader();
  return {
    forOffering: (organizationId, kind) =>
      reader.forEntity(organizationId, CUSTOM_FIELD_ENTITY_TYPE.offering, kind),
    forCategory: (organizationId) =>
      reader.forEntity(organizationId, CUSTOM_FIELD_ENTITY_TYPE.category),
  };
}

/** Sensitive values are readable and writable only with the update permission at every location (ADR-107). */
function sensitiveAccessOf(
  permissions: Pick<PermissionGate, "locationsWith">,
): SensitiveValueAccess {
  return {
    maySeeSensitive: async () =>
      (await permissions.locationsWith(PERMISSION_KEY.CATALOG_OFFERING_UPDATE)) === "ALL",
  };
}

/** An offering image is a file of this organization uploaded for that purpose (card 3.0). */
function imagesOf(): OfferingImageChecker {
  const files = buildFileReferenceReader();
  return { isUsableImage: (fileId) => files.isUsable(fileId, FILE_PURPOSE.OFFERING_IMAGE) };
}

function defaultStockTrackedOf(input: CatalogRouterInput) {
  const resolver = buildSettingsResolver({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });
  return {
    read: async (organizationId: OrganizationId) => {
      const resolved = await resolver.resolve(organizationId, {
        keys: [CATALOG_DEFAULT_STOCK_TRACKED_SETTING_KEY],
      });
      const value = resolved.get(CATALOG_DEFAULT_STOCK_TRACKED_SETTING_KEY)?.value;
      return value === true;
    },
  };
}

function defaultUnitsOf(input: CatalogRouterInput): DefaultUnitReader {
  const resolver = buildSettingsResolver({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });
  return {
    read: async (organizationId): Promise<UnitKey> => {
      const resolved = await resolver.resolve(organizationId, {
        keys: [CATALOG_DEFAULT_UNIT_SETTING_KEY],
      });
      const value = resolved.get(CATALOG_DEFAULT_UNIT_SETTING_KEY)?.value;
      return typeof value === "string" && isUnitKey(value) ? value : UNIT_KEY.PIECE;
    },
  };
}

/** The catalog router, mounted on the tenant pipeline (card 3.2a). */
export function buildCatalogTenantRouter(input: CatalogRouterInput): Router {
  const limits: LimitGuard = buildLimitGuard(input.orgConfig);
  const inventoryPorts = buildInventoryCatalogPorts();
  return buildCatalogRouter({
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
    idempotency: input.idempotency,
    limits,
    organization: organizationContextOf(input.orgConfig),
    customFields: customFieldsOf(),
    sensitiveAccess: sensitiveAccessOf(input.permissions),
    images: imagesOf(),
    locationLookup: buildLocationLookup(),
    defaultUnits: defaultUnitsOf(input),
    inventoryComponents: inventoryPorts.inventoryComponents,
    defaultStockItems: inventoryPorts.defaultStockItems,
    defaultStockTracked: defaultStockTrackedOf(input),
  });
}

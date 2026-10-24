import { buildOrderPaymentAdapter } from "./order-payment-adapter.js";
import {
  ERROR_CODE,
  PERMISSION_KEY,
  type CurrencyCode,
  type ModuleManifest,
} from "@banijjik/contracts";
import {
  DEFAULT_APPROVAL_DISCOUNT_AMOUNT_ABOVE,
  DEFAULT_APPROVAL_DISCOUNT_PERCENT_ABOVE,
  PRICING_APPROVAL_DISCOUNT_AMOUNT_ABOVE_SETTING_KEY,
  PRICING_APPROVAL_DISCOUNT_PERCENT_ABOVE_SETTING_KEY,
  PRICING_DEFAULT_TAX_CLASS_KEY_SETTING_KEY,
  PRICING_ROUNDING,
  PRICING_ROUNDING_SETTING_KEY,
  PRICING_TAX_INCLUSIVE_SETTING_KEY,
  isPricingRounding,
  type PricingRounding,
} from "@banijjik/contracts/pricing";
import type { RequestHandler, Router } from "express";
import type { PermissionGate, PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { AppError } from "../kernel/http/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildDefaultCatalogQuoteReader } from "../modules/commerce/catalog/index.js";
import { buildInventoryCostReader, buildStockLedger } from "../modules/commerce/inventory/index.js";
import {
  buildSalesRouter,
  type SalesJobPorts,
  type SalesTenantPorts,
  type SalesTenantRouterDependencies,
} from "../modules/commerce/sales/index.js";
import {
  buildPriceQuoter,
  type PricingTenantDependencies,
} from "../modules/commerce/pricing/index.js";
import { buildOrganizationCurrencyReader } from "../modules/core/organization/index.js";
import { buildApprovalVerifier } from "../modules/core/iam/index.js";
import { buildSettingsResolver } from "../modules/core/settings/index.js";
import { buildLimitGuard, type OrgConfigService } from "../modules/platform/entitlement/index.js";

export interface SalesRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly permissions: Pick<PermissionGate, "locationsWith">;
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
}

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function roundingOf(value: unknown): PricingRounding {
  if (typeof value === "string" && isPricingRounding(value)) return value;
  return PRICING_ROUNDING.NONE;
}

/** Pricing keeps the settings reader; sales quotes through the same reader (card 3.4). */
function pricingSettingsOf(input: SalesRouterInput): PricingTenantDependencies["settings"] {
  const resolver = buildSettingsResolver({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });
  return {
    read: async (organizationId) => {
      const resolved = await resolver.resolve(organizationId, {
        keys: [
          PRICING_TAX_INCLUSIVE_SETTING_KEY,
          PRICING_ROUNDING_SETTING_KEY,
          PRICING_APPROVAL_DISCOUNT_PERCENT_ABOVE_SETTING_KEY,
          PRICING_APPROVAL_DISCOUNT_AMOUNT_ABOVE_SETTING_KEY,
          PRICING_DEFAULT_TAX_CLASS_KEY_SETTING_KEY,
        ],
      });
      const defaultKey = resolved.get(PRICING_DEFAULT_TAX_CLASS_KEY_SETTING_KEY)?.value;
      return {
        taxInclusive: resolved.get(PRICING_TAX_INCLUSIVE_SETTING_KEY)?.value === true,
        rounding: roundingOf(resolved.get(PRICING_ROUNDING_SETTING_KEY)?.value),
        approvalPercentAbove: numberOrDefault(
          resolved.get(PRICING_APPROVAL_DISCOUNT_PERCENT_ABOVE_SETTING_KEY)?.value,
          DEFAULT_APPROVAL_DISCOUNT_PERCENT_ABOVE,
        ),
        approvalAmountAbove: numberOrDefault(
          resolved.get(PRICING_APPROVAL_DISCOUNT_AMOUNT_ABOVE_SETTING_KEY)?.value,
          DEFAULT_APPROVAL_DISCOUNT_AMOUNT_ABOVE,
        ),
        defaultTaxClassKey: typeof defaultKey === "string" ? defaultKey : "",
      };
    },
  };
}

/** Pricing needs the organization currency; a tenant without one is a server-side fault. */
function organizationOf() {
  const currencies = buildOrganizationCurrencyReader();
  return {
    read: async (organizationId: Parameters<typeof currencies.read>[0]) => {
      const currency = await currencies.read(organizationId);
      if (currency === undefined) {
        throw new AppError({
          code: ERROR_CODE.INTERNAL,
          messageKey: "errors.missing_tenant_context",
        });
      }
      return { currency };
    },
  };
}

/** The quoter of an order line set: the client never sends a price (decision 2). */
function quoterOf(input: SalesRouterInput): SalesTenantPorts["quoter"] {
  const pricing: PricingTenantDependencies = {
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
    idempotency: input.idempotency,
    organization: organizationOf(),
    settings: pricingSettingsOf(input),
    catalog: buildDefaultCatalogQuoteReader(),
    locationReach: {
      mayReach: async (locationId) => {
        const reach = await input.permissions.locationsWith(PERMISSION_KEY.CATALOG_OFFERING_READ);
        return reach === "ALL" || reach.includes(locationId);
      },
    },
  };
  return buildPriceQuoter(pricing);
}

/** The worker has no request pipeline, so the guards the ledger never reads are inert. */
const unusedGuard: RequestHandler = (_request, _response, next) => next();
const unusedPermissionGuard: PermissionMiddlewareFactory = () => unusedGuard;

type LedgerBag = Pick<
  SalesRouterInput,
  "clock" | "audit" | "permission" | "idempotency" | "orgConfig" | "manifests"
>;

/**
 * The ledger of card 3.3, joined to the order's transaction. `buildStockLedger` takes the inventory
 * router's whole bag, but the ledger itself reads only the clock, audit and resolved config.
 */
function stockLedgerOf(input: LedgerBag): SalesTenantPorts["stock"] {
  return buildStockLedger({
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
    idempotency: input.idempotency,
    orgConfig: input.orgConfig,
    manifests: input.manifests,
    rebuildRateLimit: unusedGuard,
  });
}

/** The average cost per ordered variant (ADR-125); the map key is `offeringId:variantId`. */
function unitCostReaderOf(): SalesTenantPorts["unitCosts"] {
  const costs = buildInventoryCostReader();
  return {
    read: async (input) => {
      const rows = await costs.readUnitCosts(input);
      return new Map(
        [...rows].map(([key, cost]) => [
          key,
          cost === null ? null : { amount: cost.amount, currency: cost.currency as CurrencyCode },
        ]),
      );
    },
  };
}

/** Everything sales cannot build itself, plus the two guards the router mounts per route. */
export function buildSalesTenantPorts(input: SalesRouterInput): SalesTenantPorts {
  const currencies = buildOrganizationCurrencyReader();
  return {
    clock: input.clock,
    audit: input.audit,
    orgConfig: input.orgConfig,
    manifests: input.manifests,
    quoter: quoterOf(input),
    stock: stockLedgerOf(input),
    approvals: buildApprovalVerifier({ audit: input.audit, clock: input.clock }),
    limits: buildLimitGuard(input.orgConfig),
    currency: {
      read: async (organizationId) => {
        const currency = await currencies.read(organizationId);
        if (currency === undefined) {
          throw new AppError({
            code: ERROR_CODE.INTERNAL,
            messageKey: "errors.missing_tenant_context",
          });
        }
        return currency;
      },
    },
    unitCosts: unitCostReaderOf(),
    payments: buildOrderPaymentAdapter(),
  };
}

/** Orders API on the tenant pipeline (card 3.5a). */
export function buildSalesTenantRouter(input: SalesRouterInput): Router {
  const ports = buildSalesTenantPorts(input);
  const dependencies: SalesTenantRouterDependencies = {
    ...ports,
    permission: input.permission,
    idempotency: input.idempotency,
  };
  return buildSalesRouter(dependencies);
}

/**
 * The worker's bag for the two hourly jobs. It has no request pipeline, so the guards
 * `buildStockLedger` asks for and never reads are inert here.
 */
export function buildSalesJobPortsForWorker(input: {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
}): SalesJobPorts {
  return {
    ...input,
    stock: stockLedgerOf({
      ...input,
      permission: unusedPermissionGuard,
      idempotency: unusedGuard,
    }),
    payments: buildOrderPaymentAdapter(),
  };
}

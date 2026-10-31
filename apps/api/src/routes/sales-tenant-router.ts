import { buildOrderPaymentAdapter } from "./order-payment-adapter.js";
import { asSystemPort } from "../kernel/context/index.js";
import { ERROR_CODE, SYSTEM_REASON } from "@banijjik/contracts";
import { isApprovalRequired } from "../modules/commerce/payment/index.js";
import { buildMembershipDirectory } from "../modules/core/organization/index.js";
import { PERMISSION_KEY, type CurrencyCode, type ModuleManifest } from "@banijjik/contracts";
import type { RequestHandler, Router } from "express";
import type { PermissionGate, PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import type { Clock } from "../kernel/time/index.js";
import { AppError, forbidden } from "../kernel/http/index.js";
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
import {
  buildMemberPerformerReader,
  buildOrganizationCurrencyReader,
} from "../modules/core/organization/index.js";
import { buildApprovalVerifier } from "../modules/core/iam/index.js";
import { buildLimitGuard, type OrgConfigService } from "../modules/platform/entitlement/index.js";
import {
  buildOrganizationPricingContext,
  buildPricingSettingsReader,
} from "./pricing-route-ports.js";

export interface SalesRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly permissions: Pick<PermissionGate, "locationsWith">;
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
}

/** The quoter of an order line set: the client never sends a price (decision 2). */
function quoterOf(input: SalesRouterInput): SalesTenantPorts["quoter"] {
  const pricing: PricingTenantDependencies = {
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
    idempotency: input.idempotency,
    organization: buildOrganizationPricingContext(),
    settings: buildPricingSettingsReader(input),
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
/** Tenant ports for sales module (cards 3.5a, 4.3). */
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
    payments: buildOrderPaymentAdapter({
      orgConfig: input.orgConfig,
      audit: input.audit,
      clock: input.clock,
    }),
    performers: buildMemberPerformerReader(),
    kinds: {
      effectiveKinds: async (organizationId) =>
        (await input.orgConfig.forOrganization(organizationId)).config.kinds,
    },
    ...returnPortsOf(input),
  };
}

/** Returns reuse payment's refund rules and iam's membership: the refund stays in payment (plan 3.5b). */
function returnPortsOf(
  input: SalesRouterInput,
): Pick<SalesTenantPorts, "refundApproval" | "refundPermission" | "members"> {
  const directory = asSystemPort(SYSTEM_REASON.AUTH_LOOKUP, buildMembershipDirectory());
  return {
    refundApproval: {
      approvalRequired: (organizationId, hasRefundWithoutApprovalPermission) =>
        isApprovalRequired(input.orgConfig, hasRefundWithoutApprovalPermission, organizationId),
    },
    refundPermission: {
      hasRefundWithoutApproval: async (_userId, locationId) => {
        const locations = await input.permissions.locationsWith(
          PERMISSION_KEY.PAYMENT_PAYMENT_REFUND_WITHOUT_APPROVAL,
        );
        return locations === "ALL" || locations.includes(locationId);
      },
    },
    members: {
      memberIdOf: async (userId, organizationId) => {
        const membership = await directory.findActiveMembership(userId, organizationId);
        if (!membership) throw forbidden();
        return membership.memberId;
      },
    },
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
    payments: buildOrderPaymentAdapter({
      orgConfig: input.orgConfig,
      audit: input.audit,
      clock: input.clock,
    }),
  };
}

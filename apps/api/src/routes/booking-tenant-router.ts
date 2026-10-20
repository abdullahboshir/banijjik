import { ERROR_CODE, PERMISSION_KEY, type ModuleManifest } from "@banijjik/contracts";
import type { RequestHandler, Router } from "express";
import type { PermissionGate, PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { AppError } from "../kernel/http/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildDefaultCatalogQuoteReader } from "../modules/commerce/catalog/index.js";
import {
  buildBookingRouter,
  type BookingTenantDependencies,
} from "../modules/commerce/booking/index.js";
import {
  buildPriceQuoter,
  type PricingTenantDependencies,
} from "../modules/commerce/pricing/index.js";
import { buildOrganizationCurrencyReader } from "../modules/core/organization/index.js";
import { buildSettingsResolver } from "../modules/core/settings/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import {
  PRICING_APPROVAL_DISCOUNT_AMOUNT_ABOVE_SETTING_KEY,
  PRICING_APPROVAL_DISCOUNT_PERCENT_ABOVE_SETTING_KEY,
  PRICING_DEFAULT_TAX_CLASS_KEY_SETTING_KEY,
  PRICING_ROUNDING,
  PRICING_ROUNDING_SETTING_KEY,
  PRICING_TAX_INCLUSIVE_SETTING_KEY,
  DEFAULT_APPROVAL_DISCOUNT_AMOUNT_ABOVE,
  DEFAULT_APPROVAL_DISCOUNT_PERCENT_ABOVE,
  isPricingRounding,
  type PricingRounding,
} from "@banijjik/contracts/pricing";

export interface BookingRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly permissions: Pick<PermissionGate, "locationsWith">;
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
}

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

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function roundingOf(value: unknown): PricingRounding {
  if (typeof value === "string" && isPricingRounding(value)) return value;
  return PRICING_ROUNDING.NONE;
}

function pricingSettingsOf(input: BookingRouterInput): PricingTenantDependencies["settings"] {
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

function quoterOf(input: BookingRouterInput): BookingTenantDependencies["quoter"] {
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
  const quote = buildPriceQuoter(pricing);
  return {
    quote: async (payload) =>
      quote.quote({
        organizationId: payload.organizationId,
        locationId: payload.locationId,
        lines: [
          {
            offeringId: payload.offeringId,
            variantId: payload.variantId,
            quantity: 1,
            modifierOptionIds: [],
          },
        ],
      }),
  };
}

function contactCreatorOf(): BookingTenantDependencies["contacts"] {
  return {
    create: async () => {
      throw new AppError({
        code: ERROR_CODE.INTERNAL,
        messageKey: "errors.not_implemented",
      });
    },
  };
}

/** Booking API on the tenant pipeline (card 3.6). */
export function buildBookingTenantRouter(input: BookingRouterInput): Router {
  return buildBookingRouter({
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
    idempotency: input.idempotency,
    orgConfig: input.orgConfig,
    manifests: input.manifests,
    quoter: quoterOf(input),
    contacts: contactCreatorOf(),
  });
}

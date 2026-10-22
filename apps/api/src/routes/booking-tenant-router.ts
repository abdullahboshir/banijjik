import { ERROR_CODE, PERMISSION_KEY, type ModuleManifest } from "@banijjik/contracts";
import { asId, type UserId } from "@banijjik/ids";
import type { RequestHandler, Router } from "express";
import type { PermissionGate, PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { AppError } from "../kernel/http/index.js";
import { kernelEventPublisher } from "../kernel/events/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildDefaultCatalogQuoteReader } from "../modules/commerce/catalog/index.js";
import { buildInlineContactCreator } from "../modules/commerce/contact/index.js";
import {
  buildBookingRouter,
  type BookingTenantDependencies,
  type DepositCheckPort,
  type PaymentStatusReader,
} from "../modules/commerce/booking/index.js";
import { PAYMENT_REQUEST_TYPE, PAYMENT_STATUS, type Money } from "@banijjik/contracts/payment";
import {
  MongoContactStoreCreditAdapter,
  MongoPaymentRepository,
  MongoPaymentSummaryRepository,
  MongoStoreCreditRepository,
  settleBookingTermination,
} from "../modules/commerce/payment/index.js";
import type { OrganizationId } from "@banijjik/ids";
import {
  buildPriceQuoter,
  type PricingTenantDependencies,
} from "../modules/commerce/pricing/index.js";
import {
  buildOrganizationCurrencyReader,
  buildOrganizationTimezoneReader,
} from "../modules/core/organization/index.js";
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

/** The inline `{ create: { name, phone } }` of a booking body, served by the contact module. */
function contactCreatorOf(input: BookingRouterInput): BookingTenantDependencies["contacts"] {
  const creator = buildInlineContactCreator({ audit: input.audit, clock: input.clock });
  return {
    isActive: (contactId) => creator.isActive(contactId),
    create: (request) =>
      creator.findOrCreateByPhone({
        organizationId: request.organizationId,
        actorUserId: request.actorUserId === null ? null : asId<UserId>(request.actorUserId),
        name: request.name,
        phoneE164: request.phone,
      }),
  };
}

function depositCheckOf(): DepositCheckPort {
  const summaries = new MongoPaymentSummaryRepository();
  const payments = new MongoPaymentRepository();
  const storeCredits = new MongoStoreCreditRepository();
  const contactStoreCredit = new MongoContactStoreCreditAdapter();
  const timezones = buildOrganizationTimezoneReader();
  return {
    async isDepositSatisfied(input: {
      readonly organizationId: OrganizationId;
      readonly requestId: string;
      readonly requiredAmount: Money;
    }) {
      if (input.requiredAmount.amount <= 0) return true;
      const summary = await summaries.findByRequest(
        input.organizationId,
        PAYMENT_REQUEST_TYPE.BOOKING,
        input.requestId,
      );
      if (!summary) return false;
      const netPaid = summary.allocated.amount - summary.refunded.amount;
      return netPaid >= input.requiredAmount.amount;
    },
    async initializeSummary(input) {
      await summaries.ensureSummary({
        organizationId: input.organizationId,
        locationId: input.locationId,
        requestType: PAYMENT_REQUEST_TYPE.BOOKING,
        requestId: input.requestId,
        contactId: input.contactId,
        total: input.total,
        now: input.now,
      });
    },
    async settleBookingTermination(input) {
      return settleBookingTermination(
        {
          payments,
          storeCredits,
          summaries,
          contactStoreCredit,
          events: kernelEventPublisher,
          timeZone: {
            read: async (organizationId: OrganizationId) => {
              const tz = await timezones.read(organizationId);
              if (tz === undefined) {
                throw new AppError({
                  code: ERROR_CODE.INTERNAL,
                  messageKey: "errors.missing_tenant_context",
                });
              }
              return tz;
            },
          },
        },
        input,
      );
    },
  };
}

function paymentStatusReaderOf(): PaymentStatusReader {
  const summaries = new MongoPaymentSummaryRepository();
  return {
    async readStatus(input: {
      readonly organizationId: OrganizationId;
      readonly requestId: string;
    }) {
      const summary = await summaries.findByRequest(
        input.organizationId,
        PAYMENT_REQUEST_TYPE.BOOKING,
        input.requestId,
      );
      if (!summary) return PAYMENT_STATUS.UNPAID;
      return summary.paymentStatus;
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
    contacts: contactCreatorOf(input),
    depositCheck: depositCheckOf(),
    paymentStatusReader: paymentStatusReaderOf(),
  });
}

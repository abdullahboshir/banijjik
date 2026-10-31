import { PERMISSION_KEY, type ModuleManifest } from "@banijjik/contracts";
import { asId, type UserId } from "@banijjik/ids";
import type { RequestHandler, Router } from "express";
import type { PermissionGate, PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildDefaultCatalogQuoteReader } from "../modules/commerce/catalog/index.js";
import { buildInlineContactCreator } from "../modules/commerce/contact/index.js";
import {
  buildBookingRouter,
  type BookingTenantDependencies,
  type PaymentStatusReader,
} from "../modules/commerce/booking/index.js";
import { PAYMENT_REQUEST_TYPE, PAYMENT_STATUS } from "@banijjik/contracts/payment";
import { MongoPaymentSummaryRepository } from "../modules/commerce/payment/index.js";
import type { OrganizationId } from "@banijjik/ids";
import {
  buildPriceQuoter,
  type PricingTenantDependencies,
} from "../modules/commerce/pricing/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import { buildBookingDepositCheckAdapter } from "./booking-deposit-adapter.js";
import {
  buildOrganizationPricingContext,
  buildPricingSettingsReader,
} from "./pricing-route-ports.js";

export interface BookingRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly permissions: Pick<PermissionGate, "locationsWith">;
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
}

function quoterOf(input: BookingRouterInput): BookingTenantDependencies["quoter"] {
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
            quantity: payload.quantity ?? 1,
            modifierOptionIds: [],
          },
        ],
      }),
  };
}

export { quoterOf as buildRequestQuoter };

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

export function buildBookingTenantPorts(input: BookingRouterInput): BookingTenantDependencies {
  return {
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
    idempotency: input.idempotency,
    orgConfig: input.orgConfig,
    manifests: input.manifests,
    quoter: quoterOf(input),
    contacts: contactCreatorOf(input),
    depositCheck: buildBookingDepositCheckAdapter(),
    paymentStatusReader: paymentStatusReaderOf(),
  };
}

/** Booking API on the tenant pipeline (card 3.6). */
export function buildBookingTenantRouter(input: BookingRouterInput): Router {
  return buildBookingRouter(buildBookingTenantPorts(input));
}

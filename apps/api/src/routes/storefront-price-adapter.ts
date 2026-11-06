import { ERROR_CODE, type ModuleManifest } from "@banijjik/contracts";
import type { Money, QuoteLineResult } from "@banijjik/contracts/pricing";
import type { DeliveryAddress } from "@banijjik/contracts/sales/delivery";
import type {
  CheckoutFulfillment,
  CheckoutSelection,
  PublicQuoteLine,
} from "@banijjik/contracts/website";
import { asId, type OrganizationId } from "@banijjik/ids";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { AppError } from "../kernel/http/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildDefaultCatalogQuoteReader } from "../modules/commerce/catalog/index.js";
import { buildPriceQuoter } from "../modules/commerce/pricing/index.js";
import { buildDeliveryZoneRepository, resolveDeliveryFee } from "../modules/commerce/sales/index.js";
import type {
  CatalogQuoteReaderPort,
  OrgStorefrontConfigReader,
  PricedSelectionsResult,
  StorefrontOrganizationConfig,
} from "../modules/commerce/website/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import {
  buildOrganizationPricingContext,
  buildPricingSettingsReader,
} from "./pricing-route-ports.js";

export interface StorefrontPricingInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
  readonly orgConfigReader: OrgStorefrontConfigReader;
}

function isPublicLocation(config: StorefrontOrganizationConfig, locationId: string): boolean {
  return config.publicLocationIds.length === 0 || config.publicLocationIds.includes(locationId);
}

function lineRequests(selections: readonly CheckoutSelection[]): {
  readonly offeringId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly modifierOptionIds: string[];
}[] {
  return selections.map((selection) => ({
    offeringId: selection.selection.offeringId,
    variantId: selection.selection.variantId,
    quantity:
      "quantity" in selection.selection && typeof selection.selection.quantity === "number"
        ? selection.selection.quantity
        : 1,
    modifierOptionIds:
      "modifierOptionIds" in selection.selection &&
      Array.isArray(selection.selection.modifierOptionIds)
        ? [...selection.selection.modifierOptionIds]
        : [],
  }));
}

function zero(currency: Money["currency"]): Money {
  return { amount: 0, currency };
}

function deliveryAddressOf(fulfillment: CheckoutFulfillment): DeliveryAddress | null {
  if (fulfillment.address === undefined) return null;
  return {
    recipientName: fulfillment.address.recipientName,
    phoneE164: fulfillment.address.phone,
    addressLine: fulfillment.address.addressLine,
    districtCode: fulfillment.address.districtCode,
    areaCode: fulfillment.address.areaCode,
    postalCode: fulfillment.address.postalCode ?? null,
  };
}

/**
 * Prices storefront selections through the same server quoter as sales and POS (tax classes,
 * promotions, org currency, rounding). Delivery uses `resolveDeliveryFee` (D3). The upfront
 * amount is 0 here: the real payable comes from the module command at submit.
 */
export function buildStorefrontCatalogQuoter(
  input: StorefrontPricingInput,
): CatalogQuoteReaderPort {
  const settings = buildPricingSettingsReader(input);
  const organization = buildOrganizationPricingContext();
  const deliveryZones = buildDeliveryZoneRepository();

  return {
    priceSelections: async (request): Promise<PricedSelectionsResult> => {
      const config = await input.orgConfigReader.readStorefrontConfig(request.organizationId);
      const quote = await buildPriceQuoter({
        clock: input.clock,
        audit: input.audit,
        permission: () => (_request, _response, next) => next(),
        idempotency: (_request, _response, next) => next(),
        organization,
        settings,
        catalog: buildDefaultCatalogQuoteReader(),
        locationReach: {
          mayReach: async (locationId) => isPublicLocation(config, locationId),
        },
      }).quote({
        organizationId: asId<OrganizationId>(request.organizationId),
        locationId: request.locationId,
        lines: lineRequests(request.selections),
        paymentIsCash: false,
      });

      const currency = quote.totals.grandTotal.currency;
      const lines = quote.lines.map((priced, index) =>
        toPublicQuoteLine(priced, request.selections[index], currency),
      );
      const priced = await resolveDeliveryFee(
        { deliveryZones },
        {
          organizationId: asId<OrganizationId>(request.organizationId),
          method: request.fulfillment.method,
          address: deliveryAddressOf(request.fulfillment),
          currency,
        },
      );

      return {
        lines,
        total: {
          amount: quote.totals.grandTotal.amount + priced.fee.amount,
          currency,
        },
        deliveryCharge: priced.fee,
        configVersion: config.configVersion,
      };
    },
  };
}

function toPublicQuoteLine(
  priced: QuoteLineResult,
  selection: CheckoutSelection | undefined,
  currency: Money["currency"],
): PublicQuoteLine {
  if (!selection) {
    throw new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.internal" });
  }
  return {
    selectionId: selection.selectionId,
    subtotal: priced.lineGross,
    discount: { amount: priced.lineDiscount.amount, currency },
    tax: priced.lineTax,
    total: priced.lineNetTotal,
    amountRequiredBeforeConfirmation: zero(currency),
  };
}

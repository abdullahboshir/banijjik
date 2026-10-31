import { ERROR_CODE, type ModuleManifest } from "@banijjik/contracts";
import type { Money, QuoteLineResult } from "@banijjik/contracts/pricing";
import {
  WEBSITE_DELIVERY_CHARGE_SETTING_KEY,
  type CheckoutSelection,
  type PublicQuoteLine,
} from "@banijjik/contracts/website";
import { asId, type OrganizationId } from "@banijjik/ids";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { AppError } from "../kernel/http/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildDefaultCatalogQuoteReader } from "../modules/commerce/catalog/index.js";
import { buildPriceQuoter } from "../modules/commerce/pricing/index.js";
import type {
  CatalogQuoteReaderPort,
  OrgStorefrontConfigReader,
  PricedSelectionsResult,
  StorefrontOrganizationConfig,
} from "../modules/commerce/website/index.js";
import { buildSettingsResolver } from "../modules/core/settings/index.js";
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

function isDelivery(fulfillment: { method: string; kind?: string }): boolean {
  return (
    fulfillment.method === "COURIER" ||
    fulfillment.method === "OWN_RIDER" ||
    fulfillment.kind === "DELIVERY"
  );
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

/**
 * Prices storefront selections through the same server quoter as sales and POS (tax classes,
 * promotions, org currency, rounding). Delivery uses the temporary flat `website.deliveryCharge`
 * setting until COD part S1 quotes a DeliveryZone fee. The upfront amount is 0 here: the real
 * payable comes from the module command at submit (card 4.3 A5A, owner decision 2026-10-31).
 */
export function buildStorefrontCatalogQuoter(
  input: StorefrontPricingInput,
): CatalogQuoteReaderPort {
  const settings = buildPricingSettingsReader(input);
  const organization = buildOrganizationPricingContext();
  const websiteSettings = buildSettingsResolver({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });

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

      const deliveryCharge = await readDeliveryCharge({
        organizationId: request.organizationId,
        currency,
        applies: isDelivery(request.fulfillment),
        websiteSettings,
      });

      return {
        lines,
        total: {
          amount: quote.totals.grandTotal.amount + deliveryCharge.amount,
          currency,
        },
        deliveryCharge,
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

async function readDeliveryCharge(input: {
  readonly organizationId: string;
  readonly currency: Money["currency"];
  readonly applies: boolean;
  readonly websiteSettings: ReturnType<typeof buildSettingsResolver>;
}): Promise<Money> {
  if (!input.applies) return zero(input.currency);
  const resolved = await input.websiteSettings.resolve(input.organizationId, {
    keys: [WEBSITE_DELIVERY_CHARGE_SETTING_KEY],
  });
  const value = resolved.get(WEBSITE_DELIVERY_CHARGE_SETTING_KEY)?.value;
  const amount = typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
  return { amount, currency: input.currency };
}

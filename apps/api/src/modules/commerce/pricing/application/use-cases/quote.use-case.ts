import type { ManualDiscount, Money, QuoteResponse } from "@banijjik/contracts/pricing";
import { asId, type LocationId, type OfferingId, type OrganizationId } from "@banijjik/ids";
import type { Clock } from "../../../../../kernel/time/index.js";
import {
  currencyMismatch,
  locationForbidden,
  offeringNotAvailable,
  taxClassUnknown,
} from "../../domain/errors.js";
import { computeQuote, type QuoteLineSource, type QuotePromotion } from "../../domain/quote.js";
import type { PromotionRepository, TaxClassRepository } from "../ports/pricing-repositories.js";
import type {
  CatalogQuoteReader,
  LocationReachChecker,
  OrganizationPricingContext,
  PricingSettingsReader,
} from "../ports/pricing-context-ports.js";

export interface QuoteLineRequest {
  readonly offeringId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly modifierOptionIds: readonly string[];
  readonly manualDiscount?: ManualDiscount;
  readonly unitPriceOverride?: Money;
}

export interface QuoteUseCaseInput {
  readonly organizationId: OrganizationId;
  readonly locationId: string;
  readonly at?: string;
  readonly lines: readonly QuoteLineRequest[];
  readonly orderDiscount?: ManualDiscount;
  readonly paymentIsCash?: boolean;
}

export interface QuoteDependencies {
  readonly catalog: CatalogQuoteReader;
  readonly taxClasses: TaxClassRepository;
  readonly promotions: PromotionRepository;
  readonly organization: OrganizationPricingContext;
  readonly settings: PricingSettingsReader;
  readonly locationReach: LocationReachChecker;
  readonly clock: Clock;
}

type CatalogLine = Awaited<ReturnType<CatalogQuoteReader["readLines"]>>[number];
type Settings = Awaited<ReturnType<PricingSettingsReader["read"]>>;

function assertCatalogLines(
  catalogLines: readonly CatalogLine[],
  inputLines: readonly QuoteLineRequest[],
  currency: string,
): void {
  for (const [index, source] of catalogLines.entries()) {
    if (!source.isAvailable) throw offeringNotAvailable(source.offeringId);
    if (source.currency !== currency) throw currencyMismatch(`lines.${index}`);
    const override = inputLines[index]?.unitPriceOverride;
    if (override !== undefined && override.currency !== currency) {
      throw currencyMismatch(`lines.${index}.unitPriceOverride`);
    }
  }
}

async function rateByTaxClassKey(
  taxClasses: TaxClassRepository,
  catalogLines: readonly CatalogLine[],
  settings: Settings,
): Promise<Map<string, number>> {
  const classKeys = new Set<string>();
  for (const source of catalogLines) {
    const key = source.taxClassKey ?? settings.defaultTaxClassKey;
    if (key !== "") classKeys.add(key);
  }
  if (settings.defaultTaxClassKey !== "") classKeys.add(settings.defaultTaxClassKey);
  const rows = await taxClasses.findActiveByKeys([...classKeys]);
  return new Map(rows.map((row) => [row.taxClassKey, row.rateBasisPoints]));
}

function toQuoteLines(input: {
  readonly catalogLines: readonly CatalogLine[];
  readonly inputLines: readonly QuoteLineRequest[];
  readonly settings: Settings;
  readonly rateByKey: Map<string, number>;
}): QuoteLineSource[] {
  return input.catalogLines.map((source, index) => {
    const requestLine = input.inputLines[index];
    const overrideMinor = requestLine?.unitPriceOverride?.amount ?? null;
    const effectiveUnitPriceMinor = overrideMinor ?? source.unitPriceMinor;
    const key = source.taxClassKey ?? input.settings.defaultTaxClassKey;
    if (key === "") {
      return {
        ...source,
        unitPriceMinor: effectiveUnitPriceMinor,
        listUnitPriceMinor: source.unitPriceMinor,
        unitPriceOverrideMinor: overrideMinor,
        taxClassKey: undefined,
        taxRateBasisPoints: 0,
        manualDiscount: requestLine?.manualDiscount,
      };
    }
    const rate = input.rateByKey.get(key);
    if (rate === undefined) {
      throw taxClassUnknown({ offeringId: source.offeringId, taxClassKey: key });
    }
    return {
      ...source,
      unitPriceMinor: effectiveUnitPriceMinor,
      listUnitPriceMinor: source.unitPriceMinor,
      unitPriceOverrideMinor: overrideMinor,
      taxClassKey: key,
      taxRateBasisPoints: rate,
      manualDiscount: requestLine?.manualDiscount,
    };
  });
}

function toQuotePromotions(
  promotions: Awaited<ReturnType<PromotionRepository["listActiveForQuote"]>>,
): QuotePromotion[] {
  return promotions.map((promotion) => ({
    promotionId: promotion.promotionId,
    status: promotion.status,
    priority: promotion.priority,
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
    locationIds: promotion.locationIds,
    target: promotion.target,
    benefit: promotion.benefit,
    minQuantity: promotion.minQuantity,
    isStackable: promotion.isStackable,
    maxDiscountPerLine: promotion.maxDiscountPerLine,
  }));
}

/** Builds a quote for admin/POS preview and for other modules through `PriceQuoter`. */
export class QuoteUseCase {
  constructor(private readonly dependencies: QuoteDependencies) {}

  async execute(input: QuoteUseCaseInput): Promise<QuoteResponse> {
    if (!(await this.dependencies.locationReach.mayReach(input.locationId))) {
      throw locationForbidden();
    }
    const [{ currency }, settings, catalogLines, promotions] = await Promise.all([
      this.dependencies.organization.read(input.organizationId),
      this.dependencies.settings.read(input.organizationId),
      this.dependencies.catalog.readLines({
        organizationId: input.organizationId,
        locationId: input.locationId,
        lines: input.lines.map((line) => ({
          offeringId: asId<OfferingId>(line.offeringId),
          variantId: line.variantId,
          quantity: line.quantity,
          modifierOptionIds: line.modifierOptionIds,
        })),
      }),
      this.dependencies.promotions.listActiveForQuote(),
    ]);

    assertCatalogLines(catalogLines, input.lines, currency);
    const rateByKey = await rateByTaxClassKey(this.dependencies.taxClasses, catalogLines, settings);
    const lines = toQuoteLines({
      catalogLines,
      inputLines: input.lines,
      settings,
      rateByKey,
    });

    return computeQuote({
      currency,
      locationId: asId<LocationId>(input.locationId),
      at: input.at === undefined ? this.dependencies.clock.now() : new Date(input.at),
      lines,
      promotions: toQuotePromotions(promotions),
      orderDiscount: input.orderDiscount,
      taxInclusive: settings.taxInclusive,
      rounding: settings.rounding,
      paymentIsCash: input.paymentIsCash ?? false,
      approvalPercentAbove: settings.approvalPercentAbove,
      approvalAmountAbove: settings.approvalAmountAbove,
    });
  }
}

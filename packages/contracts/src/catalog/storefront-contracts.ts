import type { OfferingKind } from "../modules/offering-kind.js";
import type { LocalizedText } from "../platform/industry-template.js";
import type { Money } from "../pricing/pricing-contracts.js";

export type { OfferingKind } from "../modules/offering-kind.js";

/** Storefront sections the catalog module registers (10-MODULE-CATALOG). */
export const CATALOG_STOREFRONT_SECTION = {
  OFFERING_GRID: "offering-grid",
  CATEGORY_STRIP: "category-strip",
} as const;

export type CatalogStorefrontSection =
  (typeof CATALOG_STOREFRONT_SECTION)[keyof typeof CATALOG_STOREFRONT_SECTION];

/** Public offering summary for catalog grids, search results, and category listings. */
export interface PublicOfferingSummaryResponse {
  readonly offeringId: string;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly kind: OfferingKind;
  readonly categoryId: string | null;
  readonly startingPrice: Money;
  readonly mediaUrl: string | null;
  readonly activeLocationIds: readonly string[];
}

/** Public variant for offering detail selection. */
export interface PublicVariantResponse {
  readonly variantId: string;
  readonly name: LocalizedText;
  readonly sku: string | null;
  readonly price: Money;
  readonly isAvailable: boolean;
  readonly attributes: Readonly<Record<string, string>>;
}

/** Single add-on / modifier option with price delta. */
export interface PublicModifierOptionResponse {
  readonly modifierOptionId: string;
  readonly name: LocalizedText;
  readonly priceDelta: Money;
}

/** Modifier group for an offering (options selection rules). */
export interface PublicModifierGroupResponse {
  readonly modifierGroupId: string;
  readonly name: LocalizedText;
  readonly isRequired: boolean;
  readonly minSelections: number;
  readonly maxSelections: number;
  readonly options: readonly PublicModifierOptionResponse[];
}

/** Full public offering detail. Excludes internal cost, margin, supplier, and private custom fields. */
export interface PublicOfferingDetailResponse extends PublicOfferingSummaryResponse {
  readonly description: LocalizedText | null;
  readonly variants: readonly PublicVariantResponse[];
  readonly modifierGroups: readonly PublicModifierGroupResponse[];
  readonly publicCustomFields: Readonly<Record<string, unknown>>;
  readonly publishedLocationIds: readonly string[];
}

/** Public category representation with active offering count. */
export interface PublicCategoryResponse {
  readonly categoryId: string;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly parentCategoryId: string | null;
  readonly offeringCount: number;
}

/** Query parameters for public offerings browse & search. */
export interface PublicOfferingsQuery {
  readonly page?: number | undefined;
  readonly limit?: number | undefined;
  readonly q?: string | undefined;
  readonly kind?: OfferingKind | undefined;
  readonly categoryId?: string | undefined;
  readonly locationId?: string | undefined;
}

/** Paginated public offerings envelope. */
export interface PublicOfferingListResponse {
  readonly items: readonly PublicOfferingSummaryResponse[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

/** Envelope for public category list. */
export interface PublicCategoriesResponse {
  readonly items: readonly PublicCategoryResponse[];
}

/** Helper converting a plain string or partial LocalizedText into a complete LocalizedText. */
export function toLocalizedText(value: string | LocalizedText | null | undefined): LocalizedText {
  if (value === null || value === undefined) return { bn: "", en: "" };
  if (typeof value === "string") return { bn: value, en: value };
  return {
    bn: value.bn ?? value.en ?? "",
    en: value.en ?? value.bn ?? "",
  };
}

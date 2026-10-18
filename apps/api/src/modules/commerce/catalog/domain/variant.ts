import {
  VARIANT_STATUS,
  type Money,
  type QuantityRule,
  type StockComponent,
  type UnitKey,
  type VariantOverrides,
  type VariantStatus,
} from "@banijjik/contracts/catalog";

/**
 * One thing a customer can buy or book (09 section 5.3). Its id is stable across edits and never
 * reused: orders and bookings reference `(offeringId, variantId)`.
 */
export interface Variant {
  readonly variantId: string;
  readonly name: string;
  /** `{ size: "XL" }`; empty for the "Default" variant. */
  readonly optionValues: Readonly<Record<string, string>>;
  readonly price: Money;
  readonly compareAtPrice: Money | undefined;
  readonly sku: string | undefined;
  readonly barcode: string | undefined;
  readonly unitKey: UnitKey;
  readonly quantityRule: QuantityRule | undefined;
  readonly stockComponents: readonly StockComponent[];
  readonly overrides: VariantOverrides;
  readonly status: VariantStatus;
}

export function isActiveVariant(variant: Variant): boolean {
  return variant.status === VARIANT_STATUS.ACTIVE;
}

/** The same option values in any key order are the same combination. */
export function optionKeyOf(optionValues: Readonly<Record<string, string>>): string {
  const entries = Object.entries(optionValues)
    .map(([name, value]) => [name.toLowerCase(), value.toLowerCase()] as const)
    .sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify(entries);
}

/** "XL / Red" for a variant with options, "Default" for one without. */
export function derivedVariantName(optionValues: Readonly<Record<string, string>>): string {
  const values = Object.values(optionValues);
  return values.length === 0 ? DEFAULT_VARIANT_NAME : values.join(" / ");
}

export const DEFAULT_VARIANT_NAME = "Default";

/** The prices that moved between two versions of an offering, for the `priceChanged` event. */
export function hasPriceChange(before: readonly Variant[], after: readonly Variant[]): boolean {
  const previous = new Map(before.map((variant) => [variant.variantId, variant.price.amount]));
  return after.some((variant) => {
    const was = previous.get(variant.variantId);
    return was !== undefined && was !== variant.price.amount;
  });
}

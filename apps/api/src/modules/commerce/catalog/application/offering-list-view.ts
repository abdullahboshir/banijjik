import { VARIANT_STATUS, type Money, type OfferingListItem } from "@banijjik/contracts/catalog";
import { publicFilePath } from "@banijjik/contracts/file";
import type { OfferingListRow } from "./ports/offering-repository.js";
import type { OfferingLocationRow } from "./ports/record-ports.js";

const IMAGE_VARIANT = "medium";

/** The rows of one location, found by offering and variant. */
export class LocationRows {
  private readonly byKey = new Map<string, OfferingLocationRow>();

  constructor(rows: readonly OfferingLocationRow[]) {
    for (const row of rows) this.byKey.set(this.keyOf(row.offeringId, row.variantId), row);
  }

  /** A variant's own row wins over the offering-wide row, which wins over the defaults. */
  isAvailable(offeringId: string, variantId: string): boolean {
    const own = this.byKey.get(this.keyOf(offeringId, variantId));
    if (own !== undefined) return own.isAvailable;
    return this.byKey.get(this.keyOf(offeringId, undefined))?.isAvailable ?? true;
  }

  priceOf(offeringId: string, variantId: string, defaultPrice: Money): Money {
    return this.byKey.get(this.keyOf(offeringId, variantId))?.priceOverride ?? defaultPrice;
  }

  private keyOf(offeringId: string, variantId: string | undefined): string {
    return `${offeringId}:${variantId ?? ""}`;
  }
}

function lowest(prices: readonly Money[]): Money | null {
  return prices.reduce<Money | null>(
    (best, price) => (best === null || price.amount < best.amount ? price : best),
    null,
  );
}

/**
 * One list row. `priceFrom` is the lowest price of the variants that can be bought (ACTIVE, and
 * available at the asked location), after any location override; when none can be bought it falls
 * back to the ACTIVE variants so the row still shows a price. With a location, `isAvailable` says
 * whether anything can be bought there (ADR-005).
 */
export function toOfferingListItem(
  row: OfferingListRow,
  location: LocationRows | undefined,
): OfferingListItem {
  const active = row.variants.filter((variant) => variant.status === VARIANT_STATUS.ACTIVE);
  const priced = active.map((variant) => ({
    available: location?.isAvailable(row.offeringId, variant.variantId) ?? true,
    price: location?.priceOf(row.offeringId, variant.variantId, variant.price) ?? variant.price,
  }));
  const buyable = priced.filter((variant) => variant.available);
  const base = {
    offeringId: row.offeringId,
    kind: row.kind,
    name: row.name,
    slug: row.slug,
    status: row.status,
    firstImageUrl:
      row.firstImageFileId === undefined
        ? null
        : publicFilePath(row.firstImageFileId, IMAGE_VARIANT),
    priceFrom: lowest((buyable.length > 0 ? buyable : priced).map((variant) => variant.price)),
    variantCount: active.length,
    categoryIds: row.categoryIds,
    updatedAt: row.updatedAt.toISOString(),
  };
  return location === undefined ? base : { ...base, isAvailable: buyable.length > 0 };
}

export function locationRowsOf(rows: readonly OfferingLocationRow[]): LocationRows {
  return new LocationRows(rows);
}

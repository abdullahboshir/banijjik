import type { OfferingId } from "@banijjik/ids";
import { skuTaken, SkuTakenError, SlugTakenError, slugTaken } from "../domain/errors.js";
import { firstFreeSlug, slugFromName } from "../domain/slug.js";
import type { Variant } from "../domain/variant.js";
import type { OfferingRepository } from "./ports/offering-repository.js";

/**
 * The SKUs this write adds must not belong to another offering (409 with that offering's id). A SKU
 * the offering already holds is left alone. The unique index is the net for two concurrent writes.
 */
export async function assertSkusFree(
  offerings: Pick<OfferingRepository, "findOfferingIdBySku">,
  input: {
    readonly offeringId: OfferingId;
    readonly variants: readonly Variant[];
    readonly alreadyHeld: ReadonlySet<string>;
  },
): Promise<void> {
  for (const variant of input.variants) {
    const { sku } = variant;
    if (sku === undefined || input.alreadyHeld.has(sku)) continue;
    const holder = await offerings.findOfferingIdBySku(sku, input.offeringId);
    if (holder !== undefined) throw skuTaken(sku, holder);
  }
}

export function skusOf(variants: readonly Variant[]): ReadonlySet<string> {
  return new Set(variants.flatMap((variant) => (variant.sku === undefined ? [] : [variant.sku])));
}

/**
 * The slug for a new or renamed offering. An explicit slug must be free (409). Without one it is
 * made from the name, and a taken one gets `-2`, `-3`, ... (ADR-116).
 */
export async function chooseSlug(
  offerings: Pick<OfferingRepository, "findSlugsStartingWith">,
  input: {
    readonly name: string;
    readonly explicitSlug: string | undefined;
    readonly offeringId: OfferingId;
    /** The slug the offering already has: keeping it is not a clash. */
    readonly currentSlug?: string | undefined;
  },
): Promise<string> {
  const { explicitSlug, currentSlug } = input;
  if (explicitSlug !== undefined) {
    if (explicitSlug === currentSlug) return explicitSlug;
    const taken = await offerings.findSlugsStartingWith(explicitSlug);
    if (taken.has(explicitSlug)) throw slugTaken(explicitSlug);
    return explicitSlug;
  }
  const base = slugFromName(input.name, { prefix: "o", recordId: input.offeringId });
  const taken = await offerings.findSlugsStartingWith(base);
  return firstFreeSlug(base, taken);
}

/**
 * A unique-index refusal ends the aborted transaction; only now can the winner be read. A SKU clash
 * becomes the 409 that names the offering holding it; a slug clash is reported as taken.
 */
export async function explainIndexRefusal(
  offerings: Pick<OfferingRepository, "findOfferingIdBySku">,
  error: unknown,
): Promise<unknown> {
  if (error instanceof SkuTakenError) {
    const holder = await offerings.findOfferingIdBySku(error.sku);
    return skuTaken(error.sku, holder ?? "");
  }
  if (error instanceof SlugTakenError) return slugTaken(error.slug);
  return error;
}

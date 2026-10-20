import { LISTING_FIELD_TIER, type ListingFieldTier } from "@banijjik/contracts/directory";
import type { Translator } from "@banijjik/i18n";

/** Staff review labels so the reviewer sees who will get each answer (plan M.3). */
export function listingTierLabelOf(tier: ListingFieldTier | undefined, t: Translator["t"]): string {
  const key = tier ?? LISTING_FIELD_TIER.PUBLIC;
  return t(`directory.tier.${key}`);
}

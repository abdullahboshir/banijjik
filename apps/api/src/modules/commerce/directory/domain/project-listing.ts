import {
  LISTING_FIELD_TIER,
  LISTING_VIEWER,
  type ListingFieldTier,
  type ListingViewer,
} from "@banijjik/contracts/directory";

/** Minimal field shape for projection (domain must not import validation). */
export interface ListingFieldForProjection {
  readonly fieldKey: string;
  readonly listingTier?: ListingFieldTier | undefined;
}

const TIER_RANK: Readonly<Record<ListingFieldTier, number>> = {
  [LISTING_FIELD_TIER.PUBLIC]: 0,
  [LISTING_FIELD_TIER.MEMBERS]: 1,
  [LISTING_FIELD_TIER.UNLOCKED]: 2,
  [LISTING_FIELD_TIER.PRIVATE]: 3,
};

/** Highest tier the viewer may receive. OWNER and STAFF see every tier. */
function maxTierOf(viewer: ListingViewer): ListingFieldTier {
  if (viewer === LISTING_VIEWER.OWNER || viewer === LISTING_VIEWER.STAFF) {
    return LISTING_FIELD_TIER.PRIVATE;
  }
  if (viewer === LISTING_VIEWER.UNLOCKED_MEMBER) return LISTING_FIELD_TIER.UNLOCKED;
  if (viewer === LISTING_VIEWER.MEMBER) return LISTING_FIELD_TIER.MEMBERS;
  return LISTING_FIELD_TIER.PUBLIC;
}

function tierOf(field: ListingFieldForProjection): ListingFieldTier {
  return field.listingTier ?? LISTING_FIELD_TIER.PUBLIC;
}

/**
 * The only place that decides which listing custom-field values a caller may see (ADR-127).
 * Controllers and use cases must project through this function; they never filter fields themselves.
 * Until M.4, callers never pass UNLOCKED_MEMBER for a customer.
 */
export function projectListingFields(
  customFields: Readonly<Record<string, unknown>>,
  fields: readonly ListingFieldForProjection[],
  viewer: ListingViewer,
): Record<string, unknown> {
  const maxRank = TIER_RANK[maxTierOf(viewer)];
  const byKey = new Map(fields.map((field) => [field.fieldKey, field]));
  const projected: Record<string, unknown> = {};
  for (const [fieldKey, value] of Object.entries(customFields)) {
    const field = byKey.get(fieldKey);
    if (field === undefined) continue;
    if (TIER_RANK[tierOf(field)] > maxRank) continue;
    projected[fieldKey] = value;
  }
  return projected;
}

/** Photo file ids visible to the viewer under the photo policy (ADR-127). */
export function projectListingPhotos(input: {
  readonly photoFileIds: readonly string[];
  readonly photoPolicy: "NONE" | "BLURRED_PUBLIC" | "UNLOCKED_ONLY";
  readonly viewer: ListingViewer;
}): readonly string[] {
  if (input.photoPolicy === "NONE") return [];
  if (input.viewer === LISTING_VIEWER.OWNER || input.viewer === LISTING_VIEWER.STAFF) {
    return input.photoFileIds;
  }
  if (input.photoPolicy === "UNLOCKED_ONLY") {
    return input.viewer === LISTING_VIEWER.UNLOCKED_MEMBER ? input.photoFileIds : [];
  }
  // BLURRED_PUBLIC: ids are returned so the client can request the blurred variant; clear is gated elsewhere.
  if (
    input.viewer === LISTING_VIEWER.PUBLIC ||
    input.viewer === LISTING_VIEWER.MEMBER ||
    input.viewer === LISTING_VIEWER.UNLOCKED_MEMBER
  ) {
    return input.photoFileIds;
  }
  return [];
}

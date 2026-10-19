import { CUSTOM_FIELD_TYPE } from "@banijjik/contracts";
import { LISTING_FIELD_TIER } from "@banijjik/contracts/directory";

const FILTERABLE_FIELD_TYPES = new Set<string>([
  CUSTOM_FIELD_TYPE.SELECT,
  CUSTOM_FIELD_TYPE.MULTI_SELECT,
  CUSTOM_FIELD_TYPE.NUMBER,
  CUSTOM_FIELD_TYPE.DATE,
  CUSTOM_FIELD_TYPE.GEO_BD,
]);

const FILTERABLE_TIERS = new Set<string>([LISTING_FIELD_TIER.PUBLIC, LISTING_FIELD_TIER.MEMBERS]);

export interface ListingPropertyShape {
  readonly entityType: string;
  readonly fieldType: string;
  readonly listingTier?: string | undefined;
  readonly isFilterable?: boolean | undefined;
  readonly sectionKey?: string | undefined;
  readonly minAgeYears?: number | undefined;
  readonly mustDifferFromAccountPhone?: boolean | undefined;
}

function hasListingProperty(field: ListingPropertyShape): boolean {
  return (
    field.listingTier !== undefined ||
    field.isFilterable !== undefined ||
    field.sectionKey !== undefined ||
    field.minAgeYears !== undefined ||
    field.mustDifferFromAccountPhone !== undefined
  );
}

function typedListingPropsOk(field: ListingPropertyShape): boolean {
  if (field.minAgeYears !== undefined && field.fieldType !== CUSTOM_FIELD_TYPE.DATE) return false;
  if (
    field.mustDifferFromAccountPhone !== undefined &&
    field.fieldType !== CUSTOM_FIELD_TYPE.PHONE
  ) {
    return false;
  }
  return true;
}

function filterablePropsOk(field: ListingPropertyShape): boolean {
  if (field.isFilterable !== true) return true;
  if (!FILTERABLE_FIELD_TYPES.has(field.fieldType)) return false;
  const tier = field.listingTier ?? LISTING_FIELD_TIER.PUBLIC;
  return FILTERABLE_TIERS.has(tier);
}

/** Listing-only properties stay on listing fields; filterable tiers are PUBLIC or MEMBERS (ADR-127). */
export function listingPropertiesBelong(field: ListingPropertyShape): boolean {
  if (!hasListingProperty(field)) return true;
  if (field.entityType !== "listing") return false;
  return typedListingPropsOk(field) && filterablePropsOk(field);
}

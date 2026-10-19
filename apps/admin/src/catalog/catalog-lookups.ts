import "server-only";
import type {
  CurrencyCode,
  LocationResponse,
  OrganizationProfileResponse,
} from "@banijjik/contracts";
import type { CategoryResponse, ModifierGroupResponse } from "@banijjik/contracts/catalog";
import type { TaxClassResponse } from "@banijjik/contracts/pricing";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import type { OrgAccess } from "../shell/org-access";

const LOOKUP_PAGE_SIZE = 100;

/** The choices a catalog screen offers next to an offering: where it can be placed and what it can carry. */
export interface CatalogLookups {
  categories: CategoryResponse[];
  modifierGroups: ModifierGroupResponse[];
  taxClasses: TaxClassResponse[];
  locations: LocationResponse[];
  currency: CurrencyCode;
}

function baseOf(access: OrgAccess): string {
  return `/orgs/${access.organization.organizationId}`;
}

/**
 * Reads the active categories, add-on groups and locations once per page. A caller who may not read one
 * of them still sees the page without that choice (the API enforces either way).
 */
export async function loadCatalogLookups(access: OrgAccess): Promise<CatalogLookups> {
  const base = baseOf(access);
  const [categories, modifierGroups, taxClasses, locations, profile] = await Promise.all([
    fetchBusinessResourceIfAllowed<CategoryResponse[]>(
      `${base}/categories?limit=${LOOKUP_PAGE_SIZE}`,
    ),
    fetchBusinessResourceIfAllowed<ModifierGroupResponse[]>(
      `${base}/modifier-groups?limit=${LOOKUP_PAGE_SIZE}`,
    ),
    fetchBusinessResourceIfAllowed<TaxClassResponse[]>(
      `${base}/tax-classes?limit=${LOOKUP_PAGE_SIZE}`,
    ),
    fetchBusinessResourceIfAllowed<LocationResponse[]>(
      `${base}/locations?status=ACTIVE&limit=${LOOKUP_PAGE_SIZE}`,
    ),
    fetchBusinessResource<OrganizationProfileResponse>(`${base}/profile`),
  ]);
  return {
    categories: categories ?? [],
    modifierGroups: modifierGroups ?? [],
    taxClasses: taxClasses ?? [],
    locations: locations ?? [],
    currency: profile.data.currencyCode,
  };
}

/** The currency of the business, for screens that need no other lookup. */
export async function loadCurrency(access: OrgAccess): Promise<CurrencyCode> {
  const profile = await fetchBusinessResource<OrganizationProfileResponse>(
    `${baseOf(access)}/profile`,
  );
  return profile.data.currencyCode;
}

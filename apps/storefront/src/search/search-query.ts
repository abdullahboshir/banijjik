import { CUSTOM_FIELD_TYPE } from "@banijjik/contracts";
import type { ListingListItem, StorefrontListingField } from "@banijjik/contracts/directory";

export type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

const PAGE_PARAM = "page";
const FILTER_PREFIX = "f.";
const FIRST_PAGE = "1";
const FILTERABLE_TYPES: ReadonlySet<string> = new Set([
  CUSTOM_FIELD_TYPE.SELECT,
  CUSTOM_FIELD_TYPE.MULTI_SELECT,
  CUSTOM_FIELD_TYPE.NUMBER,
  CUSTOM_FIELD_TYPE.DATE,
]);

/**
 * The filters the search form shows: the template's filterable fields of the types the form can draw.
 * Text, location and other filters are not in the form yet (a known gap in the handoff).
 */
export function filterFieldsOf(
  fields: readonly StorefrontListingField[],
): StorefrontListingField[] {
  return fields.filter(
    (field) => field.isFilterable === true && FILTERABLE_TYPES.has(field.fieldType),
  );
}

/** The page number the visitor asked for; anything but a positive whole number is page one. */
export function pageOf(searchParams: SearchParams): number {
  const raw = firstValue(searchParams[PAGE_PARAM]);
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 ? page : Number(FIRST_PAGE);
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The API query string for a search: only the `f.<fieldKey>…` filters and the page. Anything else in the
 * visitor's URL is dropped, so the API never sees a parameter the form did not put there.
 */
export function listingQueryString(searchParams: SearchParams): string {
  return filterQuery(searchParams, pageOf(searchParams)).toString();
}

/** `page` plus the `f.` filters that have a value; nothing else from the visitor's URL. */
function filterQuery(searchParams: SearchParams, page: number): URLSearchParams {
  const query = new URLSearchParams();
  query.set(PAGE_PARAM, String(page));
  for (const [name, value] of Object.entries(searchParams)) {
    if (!name.startsWith(FILTER_PREFIX)) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item.trim() !== "") query.append(name, item.trim());
    }
  }
  return query;
}

/** The search page's own address for another page of the same filters. */
export function searchPath(searchParams: SearchParams, page: number): string {
  return `/search?${filterQuery(searchParams, page).toString()}`;
}

/** One page of listing rows, as `GET /listings` answers it (14-API section 6). */
export interface ListingSearchResult {
  readonly items: readonly ListingListItem[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

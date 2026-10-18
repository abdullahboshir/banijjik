import { OFFERING_KIND, type OfferingKind } from "@banijjik/contracts";
import { OFFERING_STATUS, type OfferingStatus } from "@banijjik/contracts/catalog";

export const CATALOG_PAGE_SIZE = 20;
const MAX_SEARCH_LENGTH = 80;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export interface CatalogQuery {
  kind: OfferingKind | undefined;
  status: OfferingStatus | undefined;
  categoryId: string | undefined;
  locationId: string | undefined;
  q: string | undefined;
  page: number;
}

type RawParam = string | string[] | undefined;

function firstOf(value: RawParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<Value extends string>(
  allowed: Record<string, Value>,
  value: string | undefined,
): Value | undefined {
  return Object.values(allowed).find((candidate) => candidate === value);
}

function idOf(value: string | undefined): string | undefined {
  return value !== undefined && UUID_PATTERN.test(value) ? value : undefined;
}

/** The list state lives in the URL (13-UX section 3). Anything unreadable is ignored, never an error. */
export function parseCatalogQuery(params: Record<string, RawParam>): CatalogQuery {
  const search = firstOf(params["q"])?.trim().slice(0, MAX_SEARCH_LENGTH);
  const page = Number(firstOf(params["page"]));
  return {
    kind: oneOf(OFFERING_KIND, firstOf(params["kind"])),
    status: oneOf(OFFERING_STATUS, firstOf(params["status"])),
    categoryId: idOf(firstOf(params["categoryId"])),
    locationId: idOf(firstOf(params["location"])),
    q: search ? search : undefined,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

function toSearchParams(query: CatalogQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.kind) params.set("kind", query.kind);
  if (query.status) params.set("status", query.status);
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.locationId) params.set("location", query.locationId);
  if (query.q) params.set("q", query.q);
  return params;
}

/** The list path with the given state; defaults (page 1, no filter) leave no trace in the URL. */
export function catalogListHref(basePath: string, query: CatalogQuery): string {
  const params = toSearchParams(query);
  if (query.page > 1) params.set("page", String(query.page));
  const text = params.toString();
  return text === "" ? basePath : `${basePath}?${text}`;
}

/** The API path of one page of offerings. */
export function offeringsApiPath(organizationId: string, query: CatalogQuery): string {
  const params = toSearchParams(query);
  params.set("page", String(query.page));
  params.set("limit", String(CATALOG_PAGE_SIZE));
  return `/orgs/${organizationId}/offerings?${params.toString()}`;
}

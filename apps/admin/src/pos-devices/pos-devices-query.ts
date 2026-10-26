type RawParam = string | string[] | undefined;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export const POS_DEVICES_PAGE_SIZE = 20;

/** The page filter of the devices screen: one location (`?location=`) and one page (`?page=`). */
export interface PosDevicesQuery {
  readonly locationId: string | undefined;
  readonly page: number;
}

function firstOf(value: RawParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A location id from the URL is used only when it is a UUID; anything else means "all locations". */
function locationIdOf(value: string | undefined): string | undefined {
  return value !== undefined && UUID_PATTERN.test(value) ? value : undefined;
}

function pageOf(value: string | undefined): number {
  if (value === undefined || !/^\d+$/u.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function parsePosDevicesQuery(params: Record<string, RawParam>): PosDevicesQuery {
  return {
    locationId: locationIdOf(firstOf(params["location"])),
    page: pageOf(firstOf(params["page"])),
  };
}

/** The screen's own URL for a query; the page number is left out on the first page. */
export function posDevicesHref(basePath: string, query: PosDevicesQuery): string {
  const params = new URLSearchParams();
  if (query.locationId) params.set("location", query.locationId);
  if (query.page > 1) params.set("page", String(query.page));
  const text = params.toString();
  return text === "" ? basePath : `${basePath}?${text}`;
}

/** The list request the API sees: the page size of this screen and the location filter, if any. */
export function posDevicesApiPath(organizationId: string, query: PosDevicesQuery): string {
  const params = new URLSearchParams();
  if (query.locationId) params.set("locationId", query.locationId);
  params.set("page", String(query.page));
  params.set("limit", String(POS_DEVICES_PAGE_SIZE));
  return `/orgs/${organizationId}/pos/devices?${params.toString()}`;
}

import { LISTING_STATUS, type ListingStatus } from "@banijjik/contracts/directory";

const STATUSES = new Set<string>(Object.values(LISTING_STATUS));

export interface DirectoryListingsQuery {
  status?: ListingStatus;
  listingNumber?: string;
  from?: string;
  to?: string;
  page: number;
}

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function optionalTrimmed(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const raw = firstString(searchParams[key])?.trim();
  return raw === undefined || raw.length === 0 ? undefined : raw;
}

function statusOf(
  searchParams: Record<string, string | string[] | undefined>,
): ListingStatus | undefined {
  const statusRaw = firstString(searchParams["status"]);
  if (statusRaw === undefined || !STATUSES.has(statusRaw)) return undefined;
  return statusRaw as ListingStatus;
}

export function parseDirectoryListingsQuery(
  searchParams: Record<string, string | string[] | undefined>,
): DirectoryListingsQuery {
  const pageRaw = Number(firstString(searchParams["page"]) ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const status = statusOf(searchParams);
  const listingNumber = optionalTrimmed(searchParams, "listingNumber");
  const from = optionalTrimmed(searchParams, "from");
  const to = optionalTrimmed(searchParams, "to");
  return {
    page,
    ...(status === undefined ? {} : { status }),
    ...(listingNumber === undefined ? {} : { listingNumber }),
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
  };
}

export function directoryListingsApiQuery(query: DirectoryListingsQuery): string {
  const params = new URLSearchParams({ page: String(query.page), limit: "50" });
  if (query.status !== undefined) params.set("status", query.status);
  if (query.listingNumber !== undefined) params.set("listingNumber", query.listingNumber);
  if (query.from !== undefined) params.set("from", query.from);
  if (query.to !== undefined) params.set("to", query.to);
  return params.toString();
}

export function directoryListingsHref(basePath: string, query: DirectoryListingsQuery): string {
  const params = new URLSearchParams();
  if (query.status !== undefined) params.set("status", query.status);
  if (query.listingNumber !== undefined) params.set("listingNumber", query.listingNumber);
  if (query.from !== undefined) params.set("from", query.from);
  if (query.to !== undefined) params.set("to", query.to);
  if (query.page > 1) params.set("page", String(query.page));
  const text = params.toString();
  return text.length === 0 ? basePath : `${basePath}?${text}`;
}

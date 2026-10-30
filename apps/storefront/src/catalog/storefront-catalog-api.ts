import type {
  PublicCategoriesResponse,
  PublicCategoryResponse,
  PublicOfferingDetailResponse,
  PublicOfferingListResponse,
  PublicOfferingsQuery,
} from "@banijjik/contracts/catalog";
import { callStorefront } from "../api/client-api";
import { readPublic } from "../api/storefront-api";

export interface PublicLocationResponse {
  readonly locationId: string;
  readonly name: string;
}

export interface PublicLocationsEnvelope {
  readonly items: readonly PublicLocationResponse[];
}

function buildOfferingsQueryString(query?: PublicOfferingsQuery): string {
  if (!query) return "";
  const params = new URLSearchParams();
  if (query.page !== undefined) params.set("page", String(query.page));
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.q) params.set("q", query.q);
  if (query.kind) params.set("kind", query.kind);
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.locationId) params.set("locationId", query.locationId);
  const search = params.toString();
  return search ? `?${search}` : "";
}

/** Server-side fetchers for Next.js server components */
export async function fetchPublicOfferings(
  organizationId: string,
  query?: PublicOfferingsQuery,
): Promise<PublicOfferingListResponse | undefined> {
  const qs = buildOfferingsQueryString(query);
  return readPublic<PublicOfferingListResponse>(`/orgs/${organizationId}/offerings${qs}`);
}

export async function fetchPublicOfferingDetail(
  organizationId: string,
  slug: string,
  locationId?: string,
): Promise<PublicOfferingDetailResponse | undefined> {
  const qs = locationId ? `?locationId=${encodeURIComponent(locationId)}` : "";
  return readPublic<PublicOfferingDetailResponse>(
    `/orgs/${organizationId}/offerings/${encodeURIComponent(slug)}${qs}`,
  );
}

export async function fetchPublicCategories(
  organizationId: string,
): Promise<PublicCategoriesResponse | undefined> {
  return readPublic<PublicCategoriesResponse>(`/orgs/${organizationId}/categories`);
}

export async function fetchPublicLocations(
  organizationId: string,
): Promise<readonly PublicLocationResponse[]> {
  try {
    const envelope = await readPublic<PublicLocationsEnvelope>(`/orgs/${organizationId}/locations`);
    return envelope?.items ?? [];
  } catch {
    return [];
  }
}

/** Client-side fetchers using proxy */
export async function clientGetOfferings(
  organizationId: string,
  query?: PublicOfferingsQuery,
): Promise<PublicOfferingListResponse | undefined> {
  const qs = buildOfferingsQueryString(query);
  const result = await callStorefront<PublicOfferingListResponse>(
    "GET",
    `/orgs/${organizationId}/offerings${qs}`,
  );
  return result.ok ? result.data : undefined;
}

export async function clientGetOfferingDetail(
  organizationId: string,
  slug: string,
  locationId?: string,
): Promise<PublicOfferingDetailResponse | undefined> {
  const qs = locationId ? `?locationId=${encodeURIComponent(locationId)}` : "";
  const result = await callStorefront<PublicOfferingDetailResponse>(
    "GET",
    `/orgs/${organizationId}/offerings/${encodeURIComponent(slug)}${qs}`,
  );
  return result.ok ? result.data : undefined;
}

export async function clientGetCategories(
  organizationId: string,
): Promise<readonly PublicCategoryResponse[]> {
  const result = await callStorefront<PublicCategoriesResponse>(
    "GET",
    `/orgs/${organizationId}/categories`,
  );
  return result.ok && result.data ? result.data.items : [];
}

export async function clientGetLocations(
  organizationId: string,
): Promise<readonly PublicLocationResponse[]> {
  try {
    const result = await callStorefront<PublicLocationsEnvelope>(
      "GET",
      `/orgs/${organizationId}/locations`,
    );
    return result.ok && result.data ? result.data.items : [];
  } catch {
    return [];
  }
}

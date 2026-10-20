import type {
  DirectoryConfigResponse,
  ListingRejectRequest,
  ListingResponse,
  ListingTransitionRequest,
  StaffListingListItem,
} from "@banijjik/contracts/directory";
import { apiFetch } from "../lib/api/api-client";

function directoryPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/directory${suffix}`;
}

export async function fetchDirectoryConfig(
  organizationId: string,
): Promise<DirectoryConfigResponse> {
  const result = await apiFetch<DirectoryConfigResponse>(directoryPath(organizationId, "/config"));
  return result.data;
}

export async function fetchDirectoryQueue(
  organizationId: string,
  query: string,
): Promise<{ items: ListingResponse[]; total: number; page: number; limit: number }> {
  const result = await apiFetch<{
    items: ListingResponse[];
    total: number;
    page: number;
    limit: number;
  }>(directoryPath(organizationId, `/queue?${query}`));
  return result.data;
}

export async function fetchStaffListings(
  organizationId: string,
  query: string,
): Promise<{ items: StaffListingListItem[]; total: number; page: number; limit: number }> {
  const result = await apiFetch<{
    items: StaffListingListItem[];
    total: number;
    page: number;
    limit: number;
  }>(directoryPath(organizationId, `/listings?${query}`));
  return result.data;
}

export async function fetchStaffListing(
  organizationId: string,
  listingId: string,
): Promise<ListingResponse> {
  const result = await apiFetch<ListingResponse>(
    directoryPath(organizationId, `/listings/${listingId}`),
  );
  return result.data;
}

export async function approveListing(
  organizationId: string,
  listingId: string,
  body: ListingTransitionRequest,
): Promise<ListingResponse> {
  const result = await apiFetch<ListingResponse>(
    directoryPath(organizationId, `/listings/${listingId}/approve`),
    { method: "POST", body },
  );
  return result.data;
}

export async function rejectListing(
  organizationId: string,
  listingId: string,
  body: ListingRejectRequest,
): Promise<ListingResponse> {
  const result = await apiFetch<ListingResponse>(
    directoryPath(organizationId, `/listings/${listingId}/reject`),
    { method: "POST", body },
  );
  return result.data;
}

export async function hideListing(
  organizationId: string,
  listingId: string,
  body: ListingTransitionRequest,
): Promise<ListingResponse> {
  const result = await apiFetch<ListingResponse>(
    directoryPath(organizationId, `/listings/${listingId}/hide`),
    { method: "POST", body },
  );
  return result.data;
}

export async function unhideListing(
  organizationId: string,
  listingId: string,
  body: ListingTransitionRequest,
): Promise<ListingResponse> {
  const result = await apiFetch<ListingResponse>(
    directoryPath(organizationId, `/listings/${listingId}/unhide`),
    { method: "POST", body },
  );
  return result.data;
}

import type { ApiResult } from "../lib/api/parse-api-response";
import type { DueItemResponse } from "@banijjik/contracts/payment";
import type { ContactListItem, ContactResponse } from "@banijjik/contracts/contact";
import { fetchBusinessResource } from "../lib/api/server-resource";

export interface DuesQuery {
  page: number;
  contactId?: string | undefined;
  requestType?: string | undefined;
}

export const DUES_PAGE_LIMIT = 20;

export function duesSearch(query: DuesQuery): string {
  return new URLSearchParams({
    page: String(query.page),
    limit: String(DUES_PAGE_LIMIT),
    ...(query.contactId ? { contactId: query.contactId } : {}),
    ...(query.requestType ? { requestType: query.requestType } : {}),
  }).toString();
}

export function fetchDues(
  organizationId: string,
  query: DuesQuery,
): Promise<ApiResult<DueItemResponse[], { total: number }>> {
  return fetchBusinessResource<DueItemResponse[], { total: number }>(
    `/orgs/${organizationId}/dues?${duesSearch(query)}`,
  );
}

export async function fetchDuesContacts(
  organizationId: string,
  text: string,
  selectedContactId: string | undefined,
): Promise<ContactListItem[]> {
  const search = new URLSearchParams({ limit: "100" });
  if (text.trim()) search.set("q", text.trim());
  const contacts = await fetchBusinessResource<ContactListItem[]>(
    `/orgs/${organizationId}/contacts?${search}`,
  );
  if (
    !selectedContactId ||
    contacts.data.some((contact) => contact.contactId === selectedContactId)
  )
    return contacts.data;
  // Pagination must keep the selected contact visible even when it is outside the choice page.
  const selected = await fetchBusinessResource<ContactResponse>(
    `/orgs/${organizationId}/contacts/${selectedContactId}`,
  );
  return [...contacts.data, selected.data];
}

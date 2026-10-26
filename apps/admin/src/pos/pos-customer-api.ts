import type { ContactListItem } from "@banijjik/contracts/contact";
import type { StoreCreditEntryResponse } from "@banijjik/contracts/payment";
import { apiFetch } from "../lib/api/api-client";

/** A short list: the cashier picks one customer from the first few matches. */
const CUSTOMER_SEARCH_LIMIT = 5;

/** Contacts whose name or phone matches the typed text. Needs `contact.contact.read`. */
export async function searchTillCustomers(
  organizationId: string,
  text: string,
): Promise<readonly ContactListItem[]> {
  const search = new URLSearchParams({ q: text.trim(), limit: String(CUSTOMER_SEARCH_LIMIT) });
  const result = await apiFetch<ContactListItem[]>(`/orgs/${organizationId}/contacts?${search}`);
  return result.data;
}

/**
 * The balance after the newest store-credit entry; no entry means no credit held. Needs
 * `payment.storeCredit.read`.
 */
export async function fetchStoreCreditBalanceMinor(
  organizationId: string,
  contactId: string,
): Promise<number> {
  const search = new URLSearchParams({ contactId, limit: "1" });
  const result = await apiFetch<StoreCreditEntryResponse[]>(
    `/orgs/${organizationId}/store-credit?${search}`,
  );
  return result.data[0]?.balanceAfterMinor ?? 0;
}

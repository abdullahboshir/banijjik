import type {
  ContactAnonymizeRequest,
  ContactCreateRequest,
  ContactListItem,
  ContactResponse,
  ContactUpdateRequest,
} from "@banijjik/contracts/contact";
import { apiFetch } from "../lib/api/api-client";

const SEARCH_LIMIT = 8;

function contactsPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/contacts${suffix}`;
}

/** `POST /orgs/{organizationId}/contacts`; the same key on a retry gives the same contact. */
export async function createContact(
  organizationId: string,
  body: ContactCreateRequest,
  idempotencyKey: string,
): Promise<ContactResponse> {
  const result = await apiFetch<ContactResponse>(contactsPath(organizationId), {
    method: "POST",
    body,
    idempotencyKey,
  });
  return result.data;
}

/** `PATCH …/contacts/{contactId}` with the version read. */
export async function updateContact(
  organizationId: string,
  contactId: string,
  body: ContactUpdateRequest,
): Promise<ContactResponse> {
  const result = await apiFetch<ContactResponse>(contactsPath(organizationId, `/${contactId}`), {
    method: "PATCH",
    body,
  });
  return result.data;
}

export async function archiveContact(
  organizationId: string,
  contactId: string,
  version: number,
): Promise<ContactResponse> {
  const result = await apiFetch<ContactResponse>(
    contactsPath(organizationId, `/${contactId}/archive`),
    { method: "POST", body: { version } },
  );
  return result.data;
}

/** Erasure on request: irreversible (ADR-110). */
export async function anonymizeContact(
  organizationId: string,
  contactId: string,
  body: ContactAnonymizeRequest,
): Promise<ContactResponse> {
  const result = await apiFetch<ContactResponse>(
    contactsPath(organizationId, `/${contactId}/anonymize`),
    { method: "POST", body },
  );
  return result.data;
}

/** The first page of contacts matching what was typed, for the contact-link input. */
export async function searchContacts(
  organizationId: string,
  text: string,
): Promise<ContactListItem[]> {
  const params = new URLSearchParams({ q: text, limit: String(SEARCH_LIMIT) });
  const result = await apiFetch<ContactListItem[]>(
    contactsPath(organizationId, `?${params.toString()}`),
  );
  return result.data;
}

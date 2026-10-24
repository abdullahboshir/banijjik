import { CONTACT_ROLE } from "@banijjik/contracts";
import { CONTACT_TYPE } from "@banijjik/contracts/contact";
import type { ContactLinkCandidate, ContactLinkValue } from "@banijjik/ui";
import { createContact, searchContacts } from "../contacts/contact-api";

/** Finds contacts for the picker and remembers their names so a chosen id can show its name. */
export async function searchContactChoices(
  organizationId: string,
  text: string,
  knownNames: Map<string, string>,
): Promise<readonly ContactLinkCandidate[]> {
  const rows = await searchContacts(organizationId, text);
  for (const row of rows) {
    knownNames.set(row.contactId, row.name ?? row.phoneE164 ?? "");
  }
  return rows.map((row) => ({
    contactId: row.contactId,
    name: row.name ?? row.phoneE164 ?? "",
    phone: row.phoneE164 ?? undefined,
  }));
}

export interface ContactResolveInput {
  readonly organizationId: string;
  readonly contact: ContactLinkValue | null;
  /** One key per screen, so a retried save never creates the contact twice. */
  readonly idempotencyKey: string;
  readonly phoneInvalidMessage: string;
}

/** The contact id to send: the picked id, a freshly created contact's id, or `null` for none. */
export async function resolveContactId(input: ContactResolveInput): Promise<string | null> {
  const { contact } = input;
  if (contact === null) return null;
  if (typeof contact === "string") return contact;
  // Loaded only when a new contact is typed: the validation package carries every request schema.
  const { normalizePhoneToE164 } = await import("@banijjik/validation");
  const phone = normalizePhoneToE164(contact.create.phone);
  if (phone === undefined) throw new Error(input.phoneInvalidMessage);
  const created = await createContact(
    input.organizationId,
    {
      contactType: CONTACT_TYPE.PERSON,
      name: contact.create.name,
      phoneE164: phone,
      contactRoles: [CONTACT_ROLE.CUSTOMER],
    },
    input.idempotencyKey,
  );
  return created.contactId;
}

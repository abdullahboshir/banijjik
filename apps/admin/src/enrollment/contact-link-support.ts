import { CONTACT_ROLE } from "@banijjik/contracts";
import { CONTACT_TYPE } from "@banijjik/contracts/contact";
import { newId } from "@banijjik/ids";
import type { ContactLinkInputProps, ContactLinkValue } from "@banijjik/ui";
import { createContact, searchContacts } from "../contacts/contact-api";
import { keyForSubmit, type KeyedSubmit } from "../invitations/idempotency-keeper";

export function contactLinkLabelsOf(t: (key: string) => string): ContactLinkInputProps["labels"] {
  return {
    search: t("form.contactLink.search"),
    noResults: t("form.contactLink.noResults"),
    createNew: t("form.contactLink.createNew"),
    name: t("form.contactLink.name"),
    phone: t("form.contactLink.phone"),
    change: t("form.contactLink.change"),
    remove: t("form.contactLink.remove"),
    linked: t("form.contactLink.linked"),
    willCreate: t("form.contactLink.willCreate"),
  };
}

export function searchContactCandidates(organizationId: string): ContactLinkInputProps["search"] {
  return async (text: string) => {
    const rows = await searchContacts(organizationId, text);
    return rows.map((row) => ({
      contactId: row.contactId,
      name: row.name ?? row.phoneE164 ?? "",
      phone: row.phoneE164 ?? undefined,
    }));
  };
}

/**
 * The saved contact behind the link input: a picked contact is used as is, a typed new person is
 * created first. A retry of the same typed person carries the same key, so it is never added twice.
 */
export async function resolveContactId(input: {
  organizationId: string;
  contact: ContactLinkValue;
  lastCreate: { current: KeyedSubmit | undefined };
}): Promise<string> {
  const { contact, lastCreate } = input;
  if (typeof contact === "string") return contact;
  lastCreate.current = keyForSubmit(lastCreate.current, JSON.stringify(contact.create), () =>
    newId(),
  );
  const created = await createContact(
    input.organizationId,
    {
      contactType: CONTACT_TYPE.PERSON,
      name: contact.create.name,
      phoneE164: contact.create.phone,
      contactRoles: [CONTACT_ROLE.CUSTOMER],
    },
    lastCreate.current.key,
  );
  return created.contactId;
}

import type {
  ContactListItem,
  ContactRelationView,
  ContactResponse,
} from "@banijjik/contracts/contact";
import type { ContactDetailView } from "../application/contact-view.js";
import type { ContactListRow } from "../application/ports/contact-repository.js";

function relationViewsOf(view: ContactDetailView): ContactRelationView[] {
  return view.contact.relations.map((relation) => ({
    relatedContactId: relation.relatedContactId,
    relationKey: relation.relationKey,
    relatedContactName: view.relatedNames.get(relation.relatedContactId) ?? null,
  }));
}

export function toContactResponse(view: ContactDetailView): ContactResponse {
  const { contact } = view;
  return {
    contactId: contact.contactId,
    contactType: contact.contactType,
    name: contact.name ?? null,
    phoneE164: contact.phoneE164 ?? null,
    additionalPhonesE164: [...contact.additionalPhonesE164],
    email: contact.email ?? null,
    contactRoles: [...contact.contactRoles],
    addresses: contact.addresses.map((address) => ({ ...address })),
    relations: relationViewsOf(view),
    tagKeys: [...contact.tagKeys],
    homeLocationId: contact.homeLocationId ?? null,
    customFields: view.customFields,
    source: contact.source,
    status: contact.status,
    anonymizedAt: contact.anonymizedAt?.toISOString() ?? null,
    version: contact.version,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

export function toContactListItem(row: ContactListRow): ContactListItem {
  return {
    contactId: row.contactId,
    name: row.name ?? null,
    phoneE164: row.phoneE164 ?? null,
    contactRoles: [...row.contactRoles],
    tagKeys: [...row.tagKeys],
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

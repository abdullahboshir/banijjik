import type { EffectiveCustomField } from "@banijjik/contracts";
import { asId, type ContactId } from "@banijjik/ids";
import type { Contact } from "../domain/contact.entity.js";
import { readableCustomFields } from "./custom-field-values.js";
import type { ContactRepository } from "./ports/contact-repository.js";
import type { SensitiveValueAccess } from "./ports/custom-field-ports.js";

/** A contact with the custom field values the caller may read and the names of the contacts it relates to. */
export interface ContactDetailView {
  readonly contact: Contact;
  readonly customFields: Record<string, unknown>;
  /** contactId to name (null when that contact is anonymized). A contact that is gone has no entry. */
  readonly relatedNames: ReadonlyMap<string, string | null>;
}

export async function viewContact(
  dependencies: { contacts: ContactRepository; sensitiveAccess: SensitiveValueAccess },
  contact: Contact,
  fields: readonly EffectiveCustomField[],
): Promise<ContactDetailView> {
  const relatedIds = [...new Set(contact.relations.map((relation) => relation.relatedContactId))];
  const [canReadSensitive, relatedNames] = await Promise.all([
    dependencies.sensitiveAccess.maySeeSensitive(),
    // One batched read, however many relations there are (no N+1).
    dependencies.contacts.findNames(relatedIds.map((relatedId) => asId<ContactId>(relatedId))),
  ]);
  return {
    contact,
    relatedNames,
    customFields: readableCustomFields({
      stored: contact.customFields,
      fields,
      contactRoles: contact.contactRoles,
      canReadSensitive,
    }),
  };
}

import { REDACTED_AUDIT_VALUE } from "@banijjik/contracts";
import type { AuditFields } from "../../../../kernel/audit/index.js";
import type { Contact } from "../domain/contact.entity.js";

function redactedIfPresent(value: string | undefined): string | undefined {
  return value === undefined ? undefined : REDACTED_AUDIT_VALUE;
}

function relationsAuditValue(contact: Contact): string[] {
  return contact.relations.map(
    (relation) => `${relation.relationKey}:${relation.relatedContactId}`,
  );
}

/**
 * What an audit entry may say about a contact. A name, phone, email or address never appears, not
 * even in an entry about an edit: the entry shows that it changed, so erasing a contact later
 * leaves no personal data behind in the audit log (09 section 5.1, anonymize).
 */
export function contactAuditFields(contact: Contact): AuditFields {
  return {
    contactType: contact.contactType,
    status: contact.status,
    name: redactedIfPresent(contact.name),
    phoneE164: redactedIfPresent(contact.phoneE164),
    additionalPhonesE164:
      contact.additionalPhonesE164.length === 0 ? undefined : REDACTED_AUDIT_VALUE,
    email: redactedIfPresent(contact.email),
    contactRoles: [...contact.contactRoles],
    tagKeys: [...contact.tagKeys],
    addresses: contact.addresses.length === 0 ? undefined : REDACTED_AUDIT_VALUE,
    relations: relationsAuditValue(contact),
    homeLocationId: contact.homeLocationId,
  };
}

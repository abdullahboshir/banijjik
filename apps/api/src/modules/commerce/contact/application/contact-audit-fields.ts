import { REDACTED_AUDIT_VALUE, type AuditChanges } from "@banijjik/contracts";
import { diffAuditFields, type AuditFields } from "../../../../kernel/audit/index.js";
import type { Contact } from "../domain/contact.entity.js";

/** The fields that identify a person. Their values never reach the audit log (09 section 5.1, anonymize). */
function personalValues(
  contact: Contact | undefined,
): Readonly<Record<string, string | undefined>> {
  return {
    name: contact?.name,
    phoneE164: contact?.phoneE164,
    additionalPhonesE164:
      contact === undefined || contact.additionalPhonesE164.length === 0
        ? undefined
        : contact.additionalPhonesE164.join("|"),
    email: contact?.email,
    addresses:
      contact === undefined || contact.addresses.length === 0
        ? undefined
        : JSON.stringify(contact.addresses),
  };
}

/** The fields an audit entry may show with their real values. */
function safeFields(contact: Contact | undefined): AuditFields {
  return {
    contactType: contact?.contactType,
    status: contact?.status,
    contactRoles: contact === undefined ? undefined : [...contact.contactRoles],
    tagKeys: contact === undefined ? undefined : [...contact.tagKeys],
    relations: contact?.relations.map(
      (relation) => `${relation.relationKey}:${relation.relatedContactId}`,
    ),
    homeLocationId: contact?.homeLocationId,
  };
}

/** A personal field that changed is recorded as changed, with both sides replaced (as ADR-107 does for sensitive custom fields). */
function personalChanges(before: Contact | undefined, after: Contact): AuditChanges {
  const previous = personalValues(before);
  const current = personalValues(after);
  const changes: Record<string, { from?: string; to?: string }> = {};
  for (const [field, value] of Object.entries(current)) {
    if (value === previous[field]) continue;
    changes[field] = {
      ...(previous[field] === undefined ? {} : { from: REDACTED_AUDIT_VALUE }),
      ...(value === undefined ? {} : { to: REDACTED_AUDIT_VALUE }),
    };
  }
  return changes;
}

/**
 * What an audit entry says when a contact is created or changed (`before` is undefined on create).
 * A name, phone, email or address edit is visible as a change but holds no real value, so erasing a
 * contact later leaves no personal data behind in the audit log.
 */
export function contactAuditChanges(before: Contact | undefined, after: Contact): AuditChanges {
  return {
    ...diffAuditFields(safeFields(before), safeFields(after)),
    ...personalChanges(before, after),
  };
}

import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  type AuditAction,
  type AuditChanges,
} from "@banijjik/contracts";
import { CONTACT_EVENT_TYPE, type ContactEventType } from "@banijjik/contracts/contact";
import type { Contact } from "../domain/contact.entity.js";
import { contactAuditChanges } from "./contact-audit-fields.js";
import type { ContactWriteDependencies } from "./contact-dependencies.js";

type RecordingDependencies = Pick<ContactWriteDependencies, "audit" | "events">;

async function record(
  dependencies: RecordingDependencies,
  entry: {
    readonly action: AuditAction;
    readonly eventType: ContactEventType;
    readonly contact: Contact;
    readonly changes: AuditChanges;
  },
): Promise<void> {
  const { contact } = entry;
  await dependencies.audit.record({
    action: entry.action,
    entityType: AUDIT_ENTITY_TYPE.contact,
    entityId: contact.contactId,
    changes: entry.changes,
  });
  // The events of one contact stay in order for ORDERED handlers (card 3.8a, ADR-115).
  await dependencies.events.publish(
    entry.eventType,
    { contactId: contact.contactId },
    { orderingKey: `contact:${contact.contactId}` },
  );
}

/** One audit entry and one event for a new contact. Call inside the unit of work. */
export function recordContactCreated(
  dependencies: RecordingDependencies,
  contact: Contact,
  customFieldChanges: AuditChanges = {},
): Promise<void> {
  return record(dependencies, {
    action: AUDIT_ACTION.CONTACT_CREATED,
    eventType: CONTACT_EVENT_TYPE.CONTACT_CREATED,
    contact,
    changes: { ...contactAuditChanges(undefined, contact), ...customFieldChanges },
  });
}

/** One audit entry and one event for an edit. Call inside the unit of work. */
export function recordContactUpdated(
  dependencies: RecordingDependencies,
  change: {
    readonly before: Contact;
    readonly after: Contact;
    readonly customFieldChanges?: AuditChanges;
  },
): Promise<void> {
  return record(dependencies, {
    action: AUDIT_ACTION.CONTACT_UPDATED,
    eventType: CONTACT_EVENT_TYPE.CONTACT_UPDATED,
    contact: change.after,
    changes: {
      ...contactAuditChanges(change.before, change.after),
      ...change.customFieldChanges,
    },
  });
}

/** Archive and anonymize record the status change and, for anonymize, that personal data was cleared, never the old values. */
export function recordContactEnded(
  dependencies: RecordingDependencies,
  change: {
    readonly before: Contact;
    readonly after: Contact;
    readonly isAnonymized: boolean;
    /** Why the data was erased; the one free-text fact an anonymize entry keeps. */
    readonly reason?: string;
  },
): Promise<void> {
  return record(dependencies, {
    action: change.isAnonymized ? AUDIT_ACTION.CONTACT_ANONYMIZED : AUDIT_ACTION.CONTACT_ARCHIVED,
    eventType: change.isAnonymized
      ? CONTACT_EVENT_TYPE.CONTACT_ANONYMIZED
      : CONTACT_EVENT_TYPE.CONTACT_ARCHIVED,
    contact: change.after,
    changes: {
      ...contactAuditChanges(change.before, change.after),
      ...(change.reason === undefined ? {} : { reason: { to: change.reason } }),
    },
  });
}

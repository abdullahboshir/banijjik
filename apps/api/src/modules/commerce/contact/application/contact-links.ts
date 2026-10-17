import {
  CONTACT_ROLE,
  CUSTOM_FIELD_TYPE,
  type ContactRole,
  type EffectiveCustomField,
  type IndustryTemplateContactLink,
} from "@banijjik/contracts";
import { CONTACT_SOURCE, CONTACT_STATUS, CONTACT_TYPE } from "@banijjik/contracts/contact";
import { asId, isUuidV7, type ContactId, type OrganizationId, type UserId } from "@banijjik/ids";
import {
  contactLinkCreateSchema,
  fieldAppliesToContactRoles,
  type ContactLinkCreateValue,
} from "@banijjik/validation";
import { Contact } from "../domain/contact.entity.js";
import { invalidField } from "../domain/errors.js";
import type { ContactWriteDependencies } from "./contact-dependencies.js";
import { recordContactCreated, recordContactUpdated } from "./contact-records.js";

type LinkDependencies = Pick<ContactWriteDependencies, "contacts" | "audit" | "events" | "clock">;

interface LinkField {
  readonly fieldKey: string;
  readonly link: IndustryTemplateContactLink;
}

interface LinkActor {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
}

function pathOf(fieldKey: string): string {
  return `customFields.${fieldKey}`;
}

/** The contact-link fields the admin form shows: a REFERENCE to a contact that carries a `link` (ADR-073). */
export function linkFieldsOf(
  fields: readonly EffectiveCustomField[],
  contactRoles: readonly ContactRole[],
): LinkField[] {
  return fields.flatMap((field) =>
    field.fieldType === CUSTOM_FIELD_TYPE.REFERENCE &&
    field.referenceEntity === "contact" &&
    field.link !== undefined &&
    field.visibility.admin &&
    fieldAppliesToContactRoles(field, contactRoles)
      ? [{ fieldKey: field.fieldKey, link: field.link }]
      : [],
  );
}

async function createLinkedContact(
  dependencies: LinkDependencies,
  actor: LinkActor,
  spec: ContactLinkCreateValue["create"],
): Promise<ContactId> {
  const contact = Contact.create({
    organizationId: actor.organizationId,
    contactType: CONTACT_TYPE.PERSON,
    name: spec.name,
    phoneE164: spec.phone,
    // A linked person is known through the contact that names them: a guardian, not a customer (ADR-113).
    contactRoles: [CONTACT_ROLE.RELATED],
    source: CONTACT_SOURCE.LINKED,
    createdByUserId: actor.actorUserId,
    now: dependencies.clock.now(),
  });
  await dependencies.contacts.insert(contact);
  await recordContactCreated(dependencies, contact);
  return contact.contactId;
}

/** An existing ACTIVE contact with the phone is linked, never duplicated (dedupe rule, ADR-073). */
async function findOrCreateLinkedContact(
  dependencies: LinkDependencies,
  actor: LinkActor,
  spec: ContactLinkCreateValue["create"],
): Promise<ContactId> {
  const existing = await dependencies.contacts.findActiveByPhone(spec.phone);
  if (existing !== undefined) return existing.contactId;
  return createLinkedContact(dependencies, actor, spec);
}

/** A linked id must be an ACTIVE contact of this organization (another organization's id is simply not found). */
async function assertLinkable(
  dependencies: LinkDependencies,
  input: {
    readonly fieldKey: string;
    readonly contactId: string;
    readonly ownerId?: ContactId | undefined;
  },
): Promise<void> {
  const { fieldKey, contactId } = input;
  const target = isUuidV7(contactId)
    ? await dependencies.contacts.findById(asId<ContactId>(contactId))
    : undefined;
  const isUsable =
    target !== undefined &&
    target.status === CONTACT_STATUS.ACTIVE &&
    target.contactId !== input.ownerId;
  if (!isUsable) throw invalidField(pathOf(fieldKey), "validation.invalid_value");
}

async function resolveOne(
  dependencies: LinkDependencies,
  actor: LinkActor,
  input: {
    readonly fieldKey: string;
    readonly value: unknown;
    readonly ownerId?: ContactId | undefined;
    readonly ownerPhoneE164?: string | undefined;
  },
): Promise<unknown> {
  const { fieldKey, value } = input;
  if (typeof value === "string") {
    await assertLinkable(dependencies, { fieldKey, contactId: value, ownerId: input.ownerId });
    return value;
  }
  const parsed = contactLinkCreateSchema.safeParse(value);
  // Null clears the field and a malformed object is left for the value builder to refuse at its own path.
  if (!parsed.success) return value;
  // A contact cannot be its own guardian: the phone would belong to both.
  if (parsed.data.create.phone === input.ownerPhoneE164) {
    throw invalidField(pathOf(fieldKey), "validation.invalid_value");
  }
  return findOrCreateLinkedContact(dependencies, actor, parsed.data.create);
}

/**
 * Replaces each `{ create: { name, phone } }` of a contact-link field with the `contactId` of the
 * linked contact, creating it when no ACTIVE contact has that phone, and checks that every
 * `contactId` points at an ACTIVE contact of this organization. Runs inside the caller's unit of
 * work, so a failure later in the request leaves no orphan contact behind.
 */
export async function resolveContactLinks(
  dependencies: LinkDependencies,
  input: LinkActor & {
    readonly requested: Readonly<Record<string, unknown>>;
    readonly fields: readonly EffectiveCustomField[];
    /** The roles of the contact that owns the fields: only fields that apply to them are links. */
    readonly contactRoles: readonly ContactRole[];
    readonly ownerId?: ContactId | undefined;
    /** The phone of the contact that owns the field; a link cannot create a contact with it. */
    readonly ownerPhoneE164?: string | undefined;
  },
): Promise<Record<string, unknown>> {
  const resolved: Record<string, unknown> = { ...input.requested };
  for (const { fieldKey } of linkFieldsOf(input.fields, input.contactRoles)) {
    const value = input.requested[fieldKey];
    if (value === undefined || value === null) continue;
    resolved[fieldKey] = await resolveOne(dependencies, input, {
      fieldKey,
      value,
      ownerId: input.ownerId,
      ownerPhoneE164: input.ownerPhoneE164,
    });
  }
  return resolved;
}

async function changeRelation(
  dependencies: LinkDependencies,
  input: {
    readonly targetId: string;
    readonly actorUserId: UserId;
    readonly change: (target: Contact) => Contact;
  },
): Promise<void> {
  if (!isUuidV7(input.targetId)) return;
  const target = await dependencies.contacts.findById(asId<ContactId>(input.targetId));
  // An archived or missing target is read-only: its old relation stays as history.
  if (target === undefined || target.status !== CONTACT_STATUS.ACTIVE) return;
  const changed = input.change(target);
  if (changed === target) return;
  const saved = await dependencies.contacts.update(changed, target.version, input.actorUserId);
  await recordContactUpdated(dependencies, { before: target, after: saved });
}

/**
 * Keeps the relation on the linked contact in step with the field (ADR-073): the guardian holds
 * `GUARDIAN_OF` the student. A changed or cleared link takes the relation off the previous contact.
 */
export async function syncLinkRelations(
  dependencies: LinkDependencies,
  input: {
    readonly actorUserId: UserId;
    readonly ownerId: ContactId;
    readonly fields: readonly EffectiveCustomField[];
    readonly contactRoles: readonly ContactRole[];
    readonly before: Readonly<Record<string, unknown>>;
    readonly after: Readonly<Record<string, unknown>>;
  },
): Promise<void> {
  for (const { fieldKey, link } of linkFieldsOf(input.fields, input.contactRoles)) {
    const previous = input.before[fieldKey];
    const current = input.after[fieldKey];
    if (previous === current) continue;
    const relation = { relatedContactId: input.ownerId, relationKey: link.relationKey };
    if (typeof previous === "string") {
      await changeRelation(dependencies, {
        targetId: previous,
        actorUserId: input.actorUserId,
        change: (target) => target.withoutRelation(relation),
      });
    }
    if (typeof current === "string") {
      await changeRelation(dependencies, {
        targetId: current,
        actorUserId: input.actorUserId,
        change: (target) => target.withRelation(relation),
      });
    }
  }
}

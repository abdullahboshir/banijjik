import { CONTACT_ROLE } from "@banijjik/contracts";
import { CONTACT_SOURCE, CONTACT_TYPE } from "@banijjik/contracts/contact";
import type { ContactId, OrganizationId, UserId } from "@banijjik/ids";
import { Contact } from "../domain/contact.entity.js";
import { recordContactCreated } from "./contact-records.js";
import type { ContactWriteDependencies } from "./contact-dependencies.js";

type CreatorDependencies = Pick<
  ContactWriteDependencies,
  "contacts" | "unitOfWork" | "events" | "audit" | "clock"
>;

export interface InlineContactCreate {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId | null;
  readonly name: string;
  readonly phoneE164: string;
}

/**
 * The inline `{ create: { name, phone } }` another module's request body carries (card 3.6's
 * booking sheet, the 3.1b link-input pattern): an ACTIVE contact with the phone is reused, never
 * duplicated (09 section 5.1). The party itself is booked, so a new contact is a CUSTOMER, not a
 * RELATED person known through another contact (ADR-113).
 */
export async function findOrCreateInlineContact(
  dependencies: CreatorDependencies,
  input: InlineContactCreate,
): Promise<ContactId> {
  const existing = await dependencies.contacts.findActiveByPhone(input.phoneE164);
  if (existing !== undefined) return existing.contactId;
  const contact = await dependencies.unitOfWork.run(async () => {
    const created = Contact.create({
      organizationId: input.organizationId,
      contactType: CONTACT_TYPE.PERSON,
      name: input.name,
      phoneE164: input.phoneE164,
      contactRoles: [CONTACT_ROLE.CUSTOMER],
      source: CONTACT_SOURCE.MANUAL,
      createdByUserId: input.actorUserId,
      now: dependencies.clock.now(),
    });
    await dependencies.contacts.insert(created);
    await recordContactCreated(dependencies, created);
    return created;
  });
  return contact.contactId;
}

import { type ContactRole, type EffectiveCustomField } from "@banijjik/contracts";
import {
  CONTACT_SOURCE,
  type ContactAddressInput,
  type ContactType,
} from "@banijjik/contracts/contact";
import { Contact } from "../../domain/contact.entity.js";
import type { ContactDetailView } from "../contact-view.js";
import { viewContact } from "../contact-view.js";
import { resolveContactLinks, syncLinkRelations } from "../contact-links.js";
import { recordContactCreated } from "../contact-records.js";
import type { ContactWriteDependencies } from "../contact-dependencies.js";
import { mergeCustomFieldValues } from "../custom-field-values.js";
import { asDuplicateAnswer, assertNotDuplicate } from "../duplicate-guard.js";
import { requireHomeLocation } from "../home-location.js";
import type { HomeLocationLookup } from "../ports/settings-and-locations.js";
import type { ContactActorInput } from "./contact-actor-input.js";

export interface CreateContactDependencies extends ContactWriteDependencies {
  readonly locations: HomeLocationLookup;
}

export interface CreateContactInput extends ContactActorInput {
  readonly contactType: ContactType;
  readonly name?: string | undefined;
  readonly phoneE164?: string | undefined;
  readonly additionalPhonesE164?: readonly string[] | undefined;
  readonly email?: string | undefined;
  readonly contactRoles: readonly ContactRole[];
  readonly addresses?: readonly ContactAddressInput[] | undefined;
  readonly tagKeys?: readonly string[] | undefined;
  readonly homeLocationId?: string | undefined;
  /** Per key a value; a contact-link field may carry `{ create: { name, phone } }` (ADR-073). */
  readonly customFields?: Readonly<Record<string, unknown>> | undefined;
  /** The locations the caller's role reaches; checked for `homeLocationId`. */
  readonly allowedLocationIds: readonly string[] | "ALL";
}

/**
 * Adds a contact (09 section 5.1). One party, one contact: a phone (or email) that an ACTIVE
 * contact holds is a 409 naming that contact. Contact-link fields create or link their contact in
 * the same transaction, so a failure leaves nothing behind.
 */
export class CreateContactUseCase {
  constructor(private readonly dependencies: CreateContactDependencies) {}

  async execute(input: CreateContactInput): Promise<ContactDetailView> {
    const { unitOfWork, customFields, locations } = this.dependencies;
    const fields = await customFields.forContacts(input.organizationId);
    const homeLocationId =
      input.homeLocationId === undefined
        ? undefined
        : await requireHomeLocation(locations, {
            homeLocationId: input.homeLocationId,
            allowedLocationIds: input.allowedLocationIds,
          });
    try {
      const saved = await unitOfWork.run(() => this.createInside(input, fields, homeLocationId));
      return await viewContact(this.dependencies, saved, fields);
    } catch (error) {
      throw await asDuplicateAnswer(this.dependencies, error);
    }
  }

  private async createInside(
    input: CreateContactInput,
    fields: readonly EffectiveCustomField[],
    homeLocationId: Contact["homeLocationId"],
  ): Promise<Contact> {
    const { contacts, clock, sensitiveAccess } = this.dependencies;
    await assertNotDuplicate(this.dependencies, {
      organizationId: input.organizationId,
      phoneE164: input.phoneE164,
      email: input.email,
    });
    const requested = await resolveContactLinks(this.dependencies, {
      ...input,
      requested: input.customFields ?? {},
      fields,
    });
    const merged = mergeCustomFieldValues({
      stored: {},
      requested,
      fields,
      mode: "CREATE",
      canWriteSensitive: await sensitiveAccess.maySeeSensitive(),
    });
    const contact = Contact.create({
      organizationId: input.organizationId,
      contactType: input.contactType,
      name: input.name,
      phoneE164: input.phoneE164,
      additionalPhonesE164: input.additionalPhonesE164,
      email: input.email,
      contactRoles: input.contactRoles,
      addresses: input.addresses,
      tagKeys: input.tagKeys,
      homeLocationId,
      customFields: merged,
      source: CONTACT_SOURCE.MANUAL,
      createdByUserId: input.actorUserId,
      now: clock.now(),
    });
    await contacts.insert(contact);
    await recordContactCreated(this.dependencies, contact, merged.auditChanges);
    await syncLinkRelations(this.dependencies, {
      actorUserId: input.actorUserId,
      ownerId: contact.contactId,
      fields,
      before: {},
      after: merged.values,
    });
    return contact;
  }
}

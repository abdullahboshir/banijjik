import type { ContactRole, EffectiveCustomField } from "@banijjik/contracts";
import type {
  ContactAddressInput,
  ContactDedupeMode,
  ContactType,
} from "@banijjik/contracts/contact";
import type { ContactId, LocationId } from "@banijjik/ids";
import type { Contact, ContactChanges } from "../../domain/contact.entity.js";
import { contactNotFound } from "../../domain/errors.js";
import type { ContactWriteDependencies } from "../contact-dependencies.js";
import { resolveContactLinks, syncLinkRelations } from "../contact-links.js";
import { recordContactUpdated } from "../contact-records.js";
import type { ContactDetailView } from "../contact-view.js";
import { viewContact } from "../contact-view.js";
import { mergeCustomFieldValues, type MergedCustomFields } from "../custom-field-values.js";
import { assertNotDuplicate, runWithLinkRetry } from "../duplicate-guard.js";
import { requireHomeLocation } from "../home-location.js";
import type { HomeLocationLookup } from "../ports/settings-and-locations.js";
import type { ContactActorInput } from "./contact-actor-input.js";

export interface UpdateContactDependencies extends ContactWriteDependencies {
  readonly locations: HomeLocationLookup;
}

export interface UpdateContactInput extends ContactActorInput {
  readonly contactId: ContactId;
  readonly version: number;
  readonly contactType?: ContactType | undefined;
  readonly name?: string | null | undefined;
  readonly phoneE164?: string | null | undefined;
  readonly additionalPhonesE164?: readonly string[] | undefined;
  readonly email?: string | null | undefined;
  readonly contactRoles?: readonly ContactRole[] | undefined;
  readonly addresses?: readonly ContactAddressInput[] | undefined;
  readonly tagKeys?: readonly string[] | undefined;
  readonly homeLocationId?: string | null | undefined;
  /** Per key: a value sets it, `null` clears it, an absent key leaves it. */
  readonly customFields?: Readonly<Record<string, unknown>> | undefined;
  /** The locations the caller's role reaches; checked for `homeLocationId`. */
  readonly allowedLocationIds: readonly string[] | "ALL";
}

/** What is read before the transaction: the home location and the dedupe setting. */
interface PreparedUpdate {
  readonly homeLocationId: LocationId | null | undefined;
  readonly dedupeMode: ContactDedupeMode;
}

/**
 * Edits a contact. A phone or email that an ACTIVE contact already holds is the same 409 as on
 * create. A changed contact-link field moves the relation from the old linked contact to the new
 * one in the same transaction.
 */
export class UpdateContactUseCase {
  constructor(private readonly dependencies: UpdateContactDependencies) {}

  async execute(input: UpdateContactInput): Promise<ContactDetailView> {
    const { unitOfWork, customFields, dedupeModes } = this.dependencies;
    const fields = await customFields.forContacts(input.organizationId);
    const dedupeMode = await dedupeModes.read(input.organizationId);
    const homeLocationId = await this.requireHomeLocationIfSet(input);
    const ownPhone = typeof input.phoneE164 === "string" ? input.phoneE164 : undefined;
    const saved = await runWithLinkRetry(this.dependencies, ownPhone, () =>
      unitOfWork.run(() => this.updateInside(input, fields, { homeLocationId, dedupeMode })),
    );
    return viewContact(this.dependencies, saved, fields);
  }

  private async requireHomeLocationIfSet(
    input: UpdateContactInput,
  ): Promise<LocationId | null | undefined> {
    if (input.homeLocationId === undefined || input.homeLocationId === null) {
      return input.homeLocationId;
    }
    return requireHomeLocation(this.dependencies.locations, {
      homeLocationId: input.homeLocationId,
      allowedLocationIds: input.allowedLocationIds,
    });
  }

  private async updateInside(
    input: UpdateContactInput,
    fields: readonly EffectiveCustomField[],
    prepared: PreparedUpdate,
  ): Promise<Contact> {
    const { homeLocationId, dedupeMode } = prepared;
    const { contacts, sensitiveAccess } = this.dependencies;
    const existing = await contacts.findById(input.contactId);
    if (existing === undefined) throw contactNotFound();
    await this.assertNoNewDuplicate(input, existing, dedupeMode);
    const merged =
      input.customFields === undefined
        ? undefined
        : mergeCustomFieldValues({
            stored: existing.customFields,
            requested: await resolveContactLinks(this.dependencies, {
              organizationId: input.organizationId,
              actorUserId: input.actorUserId,
              requested: input.customFields,
              fields,
              ownerId: existing.contactId,
              ownerPhoneE164:
                input.phoneE164 === undefined ? existing.phoneE164 : (input.phoneE164 ?? undefined),
            }),
            fields,
            mode: "UPDATE",
            canWriteSensitive: await sensitiveAccess.maySeeSensitive(),
          });
    const edited = existing.withChanges(changesOf(input, homeLocationId, merged));
    const updated = await contacts.update(edited, input.version, input.actorUserId);
    await recordContactUpdated(this.dependencies, {
      before: existing,
      after: updated,
      ...(merged === undefined ? {} : { customFieldChanges: merged.auditChanges }),
    });
    await syncLinkRelations(this.dependencies, {
      actorUserId: input.actorUserId,
      ownerId: updated.contactId,
      fields,
      before: existing.customFields,
      after: updated.customFields,
    });
    return updated;
  }

  /** Only a phone or email that really changes can collide; the contact never collides with itself. */
  private async assertNoNewDuplicate(
    input: UpdateContactInput,
    existing: Contact,
    dedupeMode: ContactDedupeMode,
  ): Promise<void> {
    const phoneE164 = typeof input.phoneE164 === "string" ? input.phoneE164 : undefined;
    const email = typeof input.email === "string" ? input.email : undefined;
    if (phoneE164 === undefined && email === undefined) return;
    await assertNotDuplicate(this.dependencies, {
      dedupeMode,
      phoneE164,
      email,
      ignoreContactId: existing.contactId,
    });
  }
}

function changesOf(
  input: UpdateContactInput,
  homeLocationId: LocationId | null | undefined,
  merged: MergedCustomFields | undefined,
): ContactChanges {
  return {
    ...(input.contactType === undefined ? {} : { contactType: input.contactType }),
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.phoneE164 === undefined ? {} : { phoneE164: input.phoneE164 }),
    ...(input.additionalPhonesE164 === undefined
      ? {}
      : { additionalPhonesE164: input.additionalPhonesE164 }),
    ...(input.email === undefined ? {} : { email: input.email }),
    ...listChangesOf(input),
    ...(homeLocationId === undefined ? {} : { homeLocationId }),
    ...(merged === undefined ? {} : { customFields: merged }),
  };
}

function listChangesOf(input: UpdateContactInput): ContactChanges {
  return {
    ...(input.contactRoles === undefined ? {} : { contactRoles: input.contactRoles }),
    ...(input.addresses === undefined ? {} : { addresses: input.addresses }),
    ...(input.tagKeys === undefined ? {} : { tagKeys: input.tagKeys }),
  };
}

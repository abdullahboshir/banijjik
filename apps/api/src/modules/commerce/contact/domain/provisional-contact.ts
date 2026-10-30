import { CONTACT_ROLE } from "@banijjik/contracts";
import {
  CONTACT_SOURCE,
  CONTACT_TYPE,
  type CheckoutContactSnapshot,
  type CreateProvisionalContactInput,
} from "@banijjik/contracts/contact";
import { asId, type OrganizationId } from "@banijjik/ids";
import { Contact } from "./contact.entity.js";

export interface BuildProvisionalContactResult {
  readonly contact: Contact;
  readonly contactSnapshot: CheckoutContactSnapshot;
}

/**
 * Builds a provisional contact and its immutable checkout snapshot.
 * Preserves the unique organizationId/phoneE164 index by keeping phoneE164
 * strictly undefined on the Contact entity, retaining the submitted E.164 phone
 * exclusively in the private CheckoutContactSnapshot (Decision 4).
 */
export function buildProvisionalContact(
  input: CreateProvisionalContactInput,
  now: Date,
): BuildProvisionalContactResult {
  const trimmedName = input.name.trim();

  const contact = Contact.create({
    organizationId: asId<OrganizationId>(input.organizationId),
    contactType: CONTACT_TYPE.PERSON,
    name: trimmedName,
    phoneE164: undefined,
    email: undefined,
    contactRoles: [CONTACT_ROLE.CUSTOMER],
    source: CONTACT_SOURCE.STOREFRONT,
    createdByUserId: null,
    now,
  });

  const contactSnapshot: CheckoutContactSnapshot = Object.freeze({
    name: trimmedName,
    phoneE164: input.phoneE164,
    customFields: Object.freeze({ ...(input.customFields ?? {}) }),
  });

  return { contact, contactSnapshot };
}

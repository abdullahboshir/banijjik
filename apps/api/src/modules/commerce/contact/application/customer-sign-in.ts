import { CONTACT_ROLE } from "@banijjik/contracts";
import { CONTACT_SOURCE, CONTACT_TYPE } from "@banijjik/contracts/contact";
import type { OrganizationId } from "@banijjik/ids";
import { Contact } from "../domain/contact.entity.js";
import { CustomerAccount } from "../domain/customer-account.entity.js";
import type { CustomerAuthDependencies } from "./customer-auth-dependencies.js";
import { recordContactCreated } from "./contact-records.js";

type ContactDependencies = Pick<
  CustomerAuthDependencies,
  "contacts" | "audit" | "events" | "clock"
>;

/**
 * The business's contact for a verified phone: the ACTIVE one if it exists (no duplicate, the
 * dedupe rule of card 3.1a), else a new CUSTOMER contact from the public site.
 */
export async function findOrCreateCustomerContact(
  dependencies: ContactDependencies,
  input: { readonly organizationId: OrganizationId; readonly phoneE164: string },
): Promise<Contact> {
  const existing = await dependencies.contacts.findActiveByPhone(input.phoneE164);
  if (existing !== undefined) return existing;
  const contact = Contact.create({
    organizationId: input.organizationId,
    contactType: CONTACT_TYPE.PERSON,
    phoneE164: input.phoneE164,
    contactRoles: [CONTACT_ROLE.CUSTOMER],
    source: CONTACT_SOURCE.STOREFRONT,
    createdByUserId: null,
    now: dependencies.clock.now(),
  });
  await dependencies.contacts.insert(contact);
  await recordContactCreated(dependencies, contact);
  return contact;
}

/** The account of the contact, created and verified on the first successful code. */
export async function findOrCreateCustomerAccount(
  dependencies: Pick<CustomerAuthDependencies, "accounts" | "clock">,
  contact: Contact,
  phoneE164: string,
): Promise<CustomerAccount> {
  const existing = await dependencies.accounts.findByContactId(contact.contactId);
  if (existing !== undefined) return existing;
  const account = CustomerAccount.createVerified({
    contactId: contact.contactId,
    phoneE164,
    now: dependencies.clock.now(),
  });
  await dependencies.accounts.insert(account);
  return account;
}

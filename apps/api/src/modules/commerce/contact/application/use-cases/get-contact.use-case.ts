import type { ContactId, OrganizationId } from "@banijjik/ids";
import { contactNotFound } from "../../domain/errors.js";
import type { ContactDetailView } from "../contact-view.js";
import { viewContact } from "../contact-view.js";
import type { ContactRepository } from "../ports/contact-repository.js";
import type {
  ContactCustomFieldReader,
  SensitiveValueAccess,
} from "../ports/custom-field-ports.js";

export interface GetContactDependencies {
  readonly contacts: ContactRepository;
  readonly customFields: ContactCustomFieldReader;
  readonly sensitiveAccess: SensitiveValueAccess;
}

export interface GetContactInput {
  readonly organizationId: OrganizationId;
  readonly contactId: ContactId;
}

/** One contact with its relations' names and the custom fields the caller may read (ADR-107). */
export class GetContactUseCase {
  constructor(private readonly dependencies: GetContactDependencies) {}

  async execute(input: GetContactInput): Promise<ContactDetailView> {
    const { contacts, customFields } = this.dependencies;
    const contact = await contacts.findById(input.contactId);
    if (contact === undefined) throw contactNotFound();
    const fields = await customFields.forContacts(input.organizationId);
    return viewContact(this.dependencies, contact, fields);
  }
}

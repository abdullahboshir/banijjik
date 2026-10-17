import type { ContactRole } from "@banijjik/contracts";
import type { ContactStatus } from "@banijjik/contracts/contact";
import { buildContactSearch } from "../contact-search.js";
import type { ContactListRow, ContactRepository, Page } from "../ports/contact-repository.js";

export interface ListContactsInput {
  /** The typed search term: a name prefix, a phone in any typed form, or a custom field value. */
  readonly q?: string | undefined;
  readonly role?: ContactRole | undefined;
  readonly tag?: string | undefined;
  readonly status: ContactStatus;
  readonly page: number;
  readonly limit: number;
}

/** A page of lean rows. Contacts belong to the whole organization, so no location filter applies. */
export class ListContactsUseCase {
  constructor(private readonly contacts: ContactRepository) {}

  execute(input: ListContactsInput): Promise<Page<ContactListRow>> {
    const { q, role, tag, status, page, limit } = input;
    return this.contacts.list({
      status,
      page,
      limit,
      ...(q === undefined ? {} : { search: buildContactSearch(q) }),
      ...(role === undefined ? {} : { role }),
      ...(tag === undefined ? {} : { tag }),
    });
  }
}

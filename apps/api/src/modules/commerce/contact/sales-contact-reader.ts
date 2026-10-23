import { CONTACT_STATUS } from "@banijjik/contracts/contact";
import type { ContactId } from "@banijjik/ids";
import { buildContactSearch } from "./application/contact-search.js";
import { MongoContactRepository } from "./infrastructure/mongo-contact.repository.js";

/** One active contact as another module (sales, 3.5a) needs it: a name, a phone and nothing sensitive. */
export interface SalesContact {
  readonly contactId: ContactId;
  readonly name: string | null;
  readonly phoneE164: string | null;
}

const SALES_CONTACT_SEARCH_LIMIT = 20;

/**
 * The read side of contacts for orders: one contact, batched names, and the ids whose name or
 * phone starts with the list search term, using the contact indexes instead of a scan.
 */
export function buildSalesContactReader(): {
  findActive(contactId: ContactId): Promise<SalesContact | undefined>;
  findNames(contactIds: readonly ContactId[]): Promise<ReadonlyMap<string, string | null>>;
  searchActiveIds(term: string): Promise<readonly ContactId[]>;
} {
  const contacts = new MongoContactRepository();
  return {
    async findActive(contactId) {
      const contact = await contacts.findById(contactId);
      if (contact === undefined || contact.status !== CONTACT_STATUS.ACTIVE) return undefined;
      return {
        contactId: contact.contactId,
        name: contact.name ?? null,
        phoneE164: contact.phoneE164 ?? null,
      };
    },
    findNames: (contactIds) => contacts.findNames(contactIds),
    async searchActiveIds(term) {
      const page = await contacts.list({
        search: buildContactSearch(term),
        status: CONTACT_STATUS.ACTIVE,
        page: 1,
        limit: SALES_CONTACT_SEARCH_LIMIT,
      });
      return page.items.map((row) => row.contactId);
    },
  };
}

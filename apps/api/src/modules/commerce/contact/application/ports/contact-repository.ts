import type { ContactRole } from "@banijjik/contracts";
import type { ContactStatus } from "@banijjik/contracts/contact";
import type { ContactId, UserId } from "@banijjik/ids";
import type { Contact } from "../../domain/contact.entity.js";

export interface Page<Item> {
  readonly items: readonly Item[];
  readonly hasNext: boolean;
}

/** What a typed search term can match: a name prefix, a phone prefix and the searchable custom field values. */
export interface ContactSearch {
  /** Folded like the stored `nameSearch` (Bangla-folded and lower-cased). */
  readonly namePrefix: string;
  /** An E.164 prefix, present only when the term looks like a phone number. */
  readonly phonePrefix?: string;
  /** Lower-cased, matched against the searchable custom field values. */
  readonly valuePrefix: string;
}

export interface ContactListRequest {
  readonly search?: ContactSearch;
  readonly role?: ContactRole;
  readonly tag?: string;
  readonly status: ContactStatus;
  readonly page: number;
  readonly limit: number;
}

/** A list row: no custom fields, no addresses (lean projection). */
export interface ContactListRow {
  readonly contactId: ContactId;
  readonly name: string | undefined;
  readonly phoneE164: string | undefined;
  readonly contactRoles: readonly ContactRole[];
  readonly tagKeys: readonly string[];
  readonly status: ContactStatus;
  readonly updatedAt: Date;
}

/** Persistence of contacts. Every read is scoped to the active organization by the tenant plugin. */
export interface ContactRepository {
  /** Throws `ContactPhoneTakenError` when another ACTIVE contact holds the phone. */
  insert(contact: Contact): Promise<void>;
  findById(contactId: ContactId): Promise<Contact | undefined>;
  findActiveByPhone(phoneE164: string): Promise<Contact | undefined>;
  findActiveByEmail(email: string): Promise<Contact | undefined>;
  list(request: ContactListRequest): Promise<Page<ContactListRow>>;
  /** Throws `ContactPhoneTakenError` like `insert`, and a 409 CONFLICT for a stale version. */
  update(contact: Contact, expectedVersion: number, actorUserId: UserId): Promise<Contact>;
  /** One batched read: the name of each contact that exists (null when anonymized). */
  findNames(contactIds: readonly ContactId[]): Promise<ReadonlyMap<string, string | null>>;
}

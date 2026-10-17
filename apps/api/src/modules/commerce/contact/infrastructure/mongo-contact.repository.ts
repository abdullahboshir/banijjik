import { asId, type ContactId, type UserId } from "@banijjik/ids";
import { CONTACT_STATUS } from "@banijjik/contracts/contact";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type {
  ContactListRequest,
  ContactListRow,
  ContactRepository,
  Page,
} from "../application/ports/contact-repository.js";
import type { Contact } from "../domain/contact.entity.js";
import { ContactPhoneTakenError } from "../domain/errors.js";
import { buildContactFilter } from "./contact-filter.js";
import {
  contactEditableFields,
  contactOptionalFields,
  toContact,
  toContactDocument,
} from "./contact.mapper.js";
import { CONTACT_MODEL_NAME, type ContactDocument } from "./contact.schema.js";

const LIST_SORT = { updatedAt: -1, contactId: 1 } as const;
const LIST_PROJECTION = {
  _id: 0,
  contactId: 1,
  name: 1,
  phoneE164: 1,
  contactRoles: 1,
  tagKeys: 1,
  status: 1,
  updatedAt: 1,
} as const;

type ListDocument = Pick<
  ContactDocument,
  "contactId" | "name" | "phoneE164" | "contactRoles" | "tagKeys" | "status" | "updatedAt"
>;

/** The names of the optional fields; an edit that left one empty must remove it, not store null. */
const OPTIONAL_FIELD_NAMES = [
  "name",
  "nameSearch",
  "phoneE164",
  "email",
  "homeLocationId",
  "anonymizedAt",
] as const;

function toListRow(document: ListDocument): ContactListRow {
  return {
    contactId: asId<ContactId>(document.contactId),
    name: document.name,
    phoneE164: document.phoneE164,
    contactRoles: document.contactRoles,
    tagKeys: document.tagKeys,
    status: document.status,
    updatedAt: document.updatedAt,
  };
}

/** `$set` for the present optional fields, `$unset` for the absent ones. */
function optionalFieldUpdate(contact: Contact): { $set: object; $unset: object } {
  const values: Record<string, unknown> = { ...contactOptionalFields(contact) };
  const set: Record<string, unknown> = {};
  const unset: Record<string, 1> = {};
  for (const fieldName of OPTIONAL_FIELD_NAMES) {
    const value = values[fieldName];
    if (value === undefined) unset[fieldName] = 1;
    else set[fieldName] = value;
  }
  return { $set: set, $unset: unset };
}

/** Phone races end in a unique-index error; the use case turns it into the duplicate answer (decision 3). */
function asPhoneTaken(error: unknown, phoneE164: string | undefined): unknown {
  if (phoneE164 !== undefined && isDuplicateKeyError(error, "phoneE164")) {
    return new ContactPhoneTakenError(phoneE164);
  }
  return error;
}

/**
 * A tenant model: inside a request or an organization context the plugin adds the organization
 * filter to every query, so a contact of another organization is simply not found.
 */
export class MongoContactRepository implements ContactRepository {
  async insert(contact: Contact): Promise<void> {
    try {
      await this.model().create([toContactDocument(contact)], sessionOption(getActiveSession()));
    } catch (error) {
      throw asPhoneTaken(error, contact.phoneE164);
    }
  }

  findById(contactId: ContactId): Promise<Contact | undefined> {
    return this.findOneBy({ contactId });
  }

  findActiveByPhone(phoneE164: string): Promise<Contact | undefined> {
    return this.findOneBy({ phoneE164, status: CONTACT_STATUS.ACTIVE });
  }

  findActiveByEmail(email: string): Promise<Contact | undefined> {
    return this.findOneBy({ email, status: CONTACT_STATUS.ACTIVE });
  }

  async list(request: ContactListRequest): Promise<Page<ContactListRow>> {
    const { page, limit } = request;
    // One extra row tells whether another page exists, without counting the collection.
    const documents = await this.model()
      .find(buildContactFilter(request), LIST_PROJECTION, sessionOption(getActiveSession()))
      .sort(LIST_SORT)
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .lean<ListDocument[]>();
    return { items: documents.slice(0, limit).map(toListRow), hasNext: documents.length > limit };
  }

  async update(contact: Contact, expectedVersion: number, actorUserId: UserId): Promise<Contact> {
    try {
      const optional = optionalFieldUpdate(contact);
      const saved = await updateVersioned<ContactDocument>({
        model: this.model(),
        filter: { contactId: contact.contactId },
        expectedVersion,
        update: {
          $set: {
            ...contactEditableFields(contact),
            ...optional.$set,
            updatedByUserId: actorUserId,
          },
          // An empty $unset is refused by MongoDB.
          ...(Object.keys(optional.$unset).length === 0 ? {} : { $unset: optional.$unset }),
        },
      });
      return toContact(saved);
    } catch (error) {
      throw asPhoneTaken(error, contact.phoneE164);
    }
  }

  async findNames(contactIds: readonly ContactId[]): Promise<ReadonlyMap<string, string | null>> {
    if (contactIds.length === 0) return new Map();
    const documents = await this.model()
      .find(
        { contactId: { $in: contactIds } },
        { _id: 0, contactId: 1, name: 1 },
        sessionOption(getActiveSession()),
      )
      .lean<Pick<ContactDocument, "contactId" | "name">[]>();
    return new Map(documents.map((document) => [document.contactId, document.name ?? null]));
  }

  private async findOneBy(filter: object): Promise<Contact | undefined> {
    const document = await this.model()
      .findOne(filter, null, sessionOption(getActiveSession()))
      .lean<ContactDocument>();
    return document === null ? undefined : toContact(document);
  }

  private model() {
    return models({}).get<ContactDocument>(CONTACT_MODEL_NAME);
  }
}

import { type ContactRole } from "@banijjik/contracts";
import {
  CONTACT_STATUS,
  type ContactAddress,
  type ContactAddressInput,
  type ContactRelation,
  type ContactSource,
  type ContactStatus,
  type ContactSummary,
  type ContactType,
} from "@banijjik/contracts/contact";
import {
  newId,
  type ContactId,
  type LocationId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import type { CustomFieldSearchEntry, StoredCustomFields } from "./custom-field-values.js";
import { invalidField, invalidTransition } from "./errors.js";

export interface ContactProps {
  readonly contactId: ContactId;
  readonly organizationId: OrganizationId;
  readonly contactType: ContactType;
  readonly name: string | undefined;
  readonly phoneE164: string | undefined;
  readonly additionalPhonesE164: readonly string[];
  readonly email: string | undefined;
  readonly contactRoles: readonly ContactRole[];
  readonly addresses: readonly ContactAddress[];
  readonly relations: readonly ContactRelation[];
  readonly tagKeys: readonly string[];
  readonly homeLocationId: LocationId | undefined;
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly customFieldSearch: readonly CustomFieldSearchEntry[];
  readonly summary?: ContactSummary | undefined;
  readonly source: ContactSource;
  readonly status: ContactStatus;
  /** Set once by anonymize; the record stays for ledgers (09 section 5.1). */
  readonly anonymizedAt: Date | undefined;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
}

export interface NewContactInput {
  readonly organizationId: OrganizationId;
  readonly contactType: ContactType;
  readonly name?: string | undefined;
  readonly phoneE164?: string | undefined;
  readonly additionalPhonesE164?: readonly string[] | undefined;
  readonly email?: string | undefined;
  readonly contactRoles: readonly ContactRole[];
  readonly addresses?: readonly ContactAddressInput[] | undefined;
  readonly tagKeys?: readonly string[] | undefined;
  readonly homeLocationId?: LocationId | undefined;
  readonly customFields?: StoredCustomFields | undefined;
  readonly source: ContactSource;
  /** `null` when the customer created the contact by signing in, not staff (M.1). */
  readonly createdByUserId: UserId | null;
  readonly now: Date;
}

/** The fields `PATCH /contacts/{contactId}` may change. `null` clears an optional field. */
export interface ContactChanges {
  readonly contactType?: ContactType;
  readonly name?: string | null | undefined;
  readonly phoneE164?: string | null | undefined;
  readonly additionalPhonesE164?: readonly string[];
  readonly email?: string | null | undefined;
  readonly contactRoles?: readonly ContactRole[];
  readonly addresses?: readonly ContactAddressInput[];
  readonly tagKeys?: readonly string[];
  readonly homeLocationId?: LocationId | null;
  /** The merged values and search entries, already validated against the contact fields. */
  readonly customFields?: StoredCustomFields;
}

/** `undefined` keeps the current value, `null` clears it, anything else replaces it. */
function clearable<Value>(
  change: Value | null | undefined,
  current: Value | undefined,
): Value | undefined {
  if (change === undefined) return current;
  return change === null ? undefined : change;
}

function toAddress(input: ContactAddressInput): ContactAddress {
  return { ...input, addressId: input.addressId ?? newId() };
}

/** A contact needs a name or a phone; the one exception is an anonymized contact (09 section 5.1). */
function assertHasNameOrPhone(name: string | undefined, phoneE164: string | undefined): void {
  if (name === undefined && phoneE164 === undefined) {
    throw invalidField("name", "validation.too_small");
  }
}

/** The extra phones must be distinct and must not repeat the main phone. */
function assertAdditionalPhones(phoneE164: string | undefined, additional: readonly string[]) {
  const all = phoneE164 === undefined ? additional : [phoneE164, ...additional];
  if (new Set(all).size !== all.length) {
    throw invalidField("additionalPhonesE164", "validation.invalid_value");
  }
}

/** A party of the organization, named by the business's terms: customer, member, student, patient (09 section 5.1). */
export class Contact implements ContactProps {
  readonly contactId: ContactId;
  readonly organizationId: OrganizationId;
  readonly contactType: ContactType;
  readonly name: string | undefined;
  readonly phoneE164: string | undefined;
  readonly additionalPhonesE164: readonly string[];
  readonly email: string | undefined;
  readonly contactRoles: readonly ContactRole[];
  readonly addresses: readonly ContactAddress[];
  readonly relations: readonly ContactRelation[];
  readonly tagKeys: readonly string[];
  readonly homeLocationId: LocationId | undefined;
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly customFieldSearch: readonly CustomFieldSearchEntry[];
  readonly summary?: ContactSummary | undefined;
  readonly source: ContactSource;
  readonly status: ContactStatus;
  readonly anonymizedAt: Date | undefined;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;

  private constructor(props: ContactProps) {
    this.contactId = props.contactId;
    this.organizationId = props.organizationId;
    this.contactType = props.contactType;
    this.name = props.name;
    this.phoneE164 = props.phoneE164;
    this.additionalPhonesE164 = props.additionalPhonesE164;
    this.email = props.email;
    this.contactRoles = props.contactRoles;
    this.addresses = props.addresses;
    this.relations = props.relations;
    this.tagKeys = props.tagKeys;
    this.homeLocationId = props.homeLocationId;
    this.customFields = props.customFields;
    this.customFieldSearch = props.customFieldSearch;
    this.summary = props.summary;
    this.source = props.source;
    this.status = props.status;
    this.anonymizedAt = props.anonymizedAt;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
  }

  static create(input: NewContactInput): Contact {
    assertHasNameOrPhone(input.name, input.phoneE164);
    assertAdditionalPhones(input.phoneE164, input.additionalPhonesE164 ?? []);
    return new Contact({
      contactId: newId(),
      organizationId: input.organizationId,
      contactType: input.contactType,
      name: input.name,
      phoneE164: input.phoneE164,
      additionalPhonesE164: input.additionalPhonesE164 ?? [],
      email: input.email,
      contactRoles: input.contactRoles,
      addresses: (input.addresses ?? []).map(toAddress),
      relations: [],
      tagKeys: input.tagKeys ?? [],
      homeLocationId: input.homeLocationId,
      customFields: input.customFields?.values ?? {},
      customFieldSearch: input.customFields?.search ?? [],
      source: input.source,
      status: CONTACT_STATUS.ACTIVE,
      anonymizedAt: undefined,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.createdByUserId,
    });
  }

  /** Rebuilds a stored contact. The invariants were checked when it was written. */
  static restore(props: ContactProps): Contact {
    return new Contact(props);
  }

  /** An archived contact is read-only: its phone is free for a new contact, so editing it could take the phone back. */
  private assertEditable(): void {
    if (this.status !== CONTACT_STATUS.ACTIVE) throw invalidTransition(this.status);
  }

  withChanges(changes: ContactChanges): Contact {
    this.assertEditable();
    const name = clearable(changes.name, this.name);
    const phoneE164 = clearable(changes.phoneE164, this.phoneE164);
    const additionalPhonesE164 = changes.additionalPhonesE164 ?? this.additionalPhonesE164;
    assertHasNameOrPhone(name, phoneE164);
    assertAdditionalPhones(phoneE164, additionalPhonesE164);
    return new Contact({
      ...this.props(),
      contactType: changes.contactType ?? this.contactType,
      name,
      phoneE164,
      additionalPhonesE164,
      email: clearable(changes.email, this.email),
      homeLocationId: clearable(changes.homeLocationId, this.homeLocationId),
      ...this.listsAfter(changes),
    });
  }

  /** The list-valued fields and custom fields: a given value replaces the stored one. */
  private listsAfter(changes: ContactChanges) {
    return {
      contactRoles: changes.contactRoles ?? this.contactRoles,
      addresses: changes.addresses?.map(toAddress) ?? this.addresses,
      tagKeys: changes.tagKeys ?? this.tagKeys,
      customFields: changes.customFields?.values ?? this.customFields,
      customFieldSearch: changes.customFields?.search ?? this.customFieldSearch,
    };
  }

  /** Adds a relation unless the same pair exists already. */
  withRelation(relation: ContactRelation): Contact {
    this.assertEditable();
    if (this.hasRelation(relation)) return this;
    return new Contact({ ...this.props(), relations: [...this.relations, relation] });
  }

  withoutRelation(relation: ContactRelation): Contact {
    this.assertEditable();
    if (!this.hasRelation(relation)) return this;
    const kept = this.relations.filter((existing) => !sameRelation(existing, relation));
    return new Contact({ ...this.props(), relations: kept });
  }

  archive(): Contact {
    this.assertEditable();
    return new Contact({ ...this.props(), status: CONTACT_STATUS.ARCHIVED });
  }

  /**
   * Erasure on request (09 section 5.1): the personal data goes, the id and the relations stay so
   * ledgers keep pointing at a record. The contact ends archived and cannot be edited again.
   */
  anonymize(now: Date): Contact {
    if (this.anonymizedAt !== undefined) throw invalidTransition("ANONYMIZED");
    return new Contact({
      ...this.props(),
      name: undefined,
      phoneE164: undefined,
      additionalPhonesE164: [],
      email: undefined,
      addresses: [],
      customFields: {},
      customFieldSearch: [],
      status: CONTACT_STATUS.ARCHIVED,
      anonymizedAt: now,
    });
  }

  /** Whether the contact has this relation already. */
  hasRelation(relation: ContactRelation): boolean {
    return this.relations.some((existing) => sameRelation(existing, relation));
  }

  private props(): ContactProps {
    return { ...this };
  }
}

function sameRelation(left: ContactRelation, right: ContactRelation): boolean {
  return left.relatedContactId === right.relatedContactId && left.relationKey === right.relationKey;
}

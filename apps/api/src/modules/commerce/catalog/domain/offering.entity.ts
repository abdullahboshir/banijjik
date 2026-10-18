import type { OfferingKind } from "@banijjik/contracts";
import {
  OFFERING_STATUS,
  type KindDetails,
  type OfferingStatus,
} from "@banijjik/contracts/catalog";
import { newId, type OfferingId, type OrganizationId, type UserId } from "@banijjik/ids";
import { invalidTransition } from "./errors.js";
import { foldText } from "./name-search.js";
import type { Variant } from "./variant.js";

/** The custom field values a record stores, with the entries that make the searchable ones findable (ADR-015). */
export interface StoredCustomFields {
  readonly values: Readonly<Record<string, unknown>>;
  readonly search: readonly { readonly fieldKey: string; readonly value: string }[];
}

export interface OfferingProps {
  readonly offeringId: OfferingId;
  readonly organizationId: OrganizationId;
  readonly kind: OfferingKind;
  readonly name: string;
  readonly slug: string;
  readonly status: OfferingStatus;
  readonly description: string | undefined;
  readonly categoryIds: readonly string[];
  readonly modifierGroupIds: readonly string[];
  readonly imageFileIds: readonly string[];
  readonly variants: readonly Variant[];
  readonly kindDetails: KindDetails;
  readonly taxClassKey: string | undefined;
  readonly synonyms: readonly string[];
  readonly customFields: StoredCustomFields;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
}

export interface NewOfferingInput {
  readonly organizationId: OrganizationId;
  readonly kind: OfferingKind;
  readonly name: string;
  readonly slug: string;
  readonly description?: string | undefined;
  readonly categoryIds?: readonly string[] | undefined;
  readonly modifierGroupIds?: readonly string[] | undefined;
  readonly imageFileIds?: readonly string[] | undefined;
  readonly variants: readonly Variant[];
  readonly kindDetails: KindDetails;
  readonly taxClassKey?: string | undefined;
  readonly synonyms?: readonly string[] | undefined;
  readonly customFields?: StoredCustomFields | undefined;
  readonly createdByUserId: UserId;
  readonly now: Date;
}

/** The fields `PATCH /offerings/{offeringId}` may change. `null` clears an optional field. */
export interface OfferingChanges {
  readonly name?: string;
  readonly slug?: string;
  readonly description?: string | null;
  readonly categoryIds?: readonly string[];
  readonly modifierGroupIds?: readonly string[];
  readonly imageFileIds?: readonly string[];
  readonly kindDetails?: KindDetails;
  readonly taxClassKey?: string | null;
  readonly synonyms?: readonly string[];
  readonly variants?: readonly Variant[];
  readonly customFields?: StoredCustomFields;
}

const INITIAL_VERSION = 1;
const NO_CUSTOM_FIELDS: StoredCustomFields = { values: {}, search: [] };

/** `undefined` keeps the current value, `null` clears it, anything else replaces it. */
function clearable<Value>(
  change: Value | null | undefined,
  current: Value | undefined,
): Value | undefined {
  if (change === undefined) return current;
  return change === null ? undefined : change;
}

/** Folded copies of the offering name and synonyms, for prefix search. Derived, never sent by clients. */
export function nameSearchOf(name: string): string {
  return foldText(name);
}

export function synonymSearchOf(synonyms: readonly string[]): string[] {
  return [...new Set(synonyms.map(foldText))];
}

/**
 * Anything a business sells: a product, a service, a plan, a rental or an event (09 section 5.3).
 * It has at least one variant, so an order line or a booking always names `(offeringId, variantId)`.
 * The kind is fixed at creation.
 */
export class Offering implements OfferingProps {
  readonly offeringId: OfferingId;
  readonly organizationId: OrganizationId;
  readonly kind: OfferingKind;
  readonly name: string;
  readonly slug: string;
  readonly status: OfferingStatus;
  readonly description: string | undefined;
  readonly categoryIds: readonly string[];
  readonly modifierGroupIds: readonly string[];
  readonly imageFileIds: readonly string[];
  readonly variants: readonly Variant[];
  readonly kindDetails: KindDetails;
  readonly taxClassKey: string | undefined;
  readonly synonyms: readonly string[];
  readonly customFields: StoredCustomFields;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;

  private constructor(props: OfferingProps) {
    this.offeringId = props.offeringId;
    this.organizationId = props.organizationId;
    this.kind = props.kind;
    this.name = props.name;
    this.slug = props.slug;
    this.status = props.status;
    this.description = props.description;
    this.categoryIds = props.categoryIds;
    this.modifierGroupIds = props.modifierGroupIds;
    this.imageFileIds = props.imageFileIds;
    this.variants = props.variants;
    this.kindDetails = props.kindDetails;
    this.taxClassKey = props.taxClassKey;
    this.synonyms = props.synonyms;
    this.customFields = props.customFields;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
  }

  static newId(): OfferingId {
    return newId<OfferingId>();
  }

  /** A new offering starts as DRAFT: nothing reaches the storefront or the bot before publish (ADR-026). */
  static create(input: NewOfferingInput & { readonly offeringId: OfferingId }): Offering {
    return new Offering({
      offeringId: input.offeringId,
      organizationId: input.organizationId,
      kind: input.kind,
      name: input.name,
      slug: input.slug,
      status: OFFERING_STATUS.DRAFT,
      description: input.description,
      categoryIds: input.categoryIds ?? [],
      modifierGroupIds: input.modifierGroupIds ?? [],
      imageFileIds: input.imageFileIds ?? [],
      variants: input.variants,
      kindDetails: input.kindDetails,
      taxClassKey: input.taxClassKey,
      synonyms: input.synonyms ?? [],
      customFields: input.customFields ?? NO_CUSTOM_FIELDS,
      version: INITIAL_VERSION,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.createdByUserId,
    });
  }

  static restore(props: OfferingProps): Offering {
    return new Offering(props);
  }

  /** An archived offering is read-only. */
  withChanges(changes: OfferingChanges): Offering {
    this.assertEditable();
    return new Offering({
      ...this,
      name: changes.name ?? this.name,
      slug: changes.slug ?? this.slug,
      description: clearable(changes.description, this.description),
      categoryIds: changes.categoryIds ?? this.categoryIds,
      modifierGroupIds: changes.modifierGroupIds ?? this.modifierGroupIds,
      imageFileIds: changes.imageFileIds ?? this.imageFileIds,
      kindDetails: changes.kindDetails ?? this.kindDetails,
      taxClassKey: clearable(changes.taxClassKey, this.taxClassKey),
      synonyms: changes.synonyms ?? this.synonyms,
      variants: changes.variants ?? this.variants,
      customFields: changes.customFields ?? this.customFields,
    });
  }

  /** DRAFT becomes ACTIVE. ACTIVE stays as it is (the caller then writes nothing). ARCHIVED cannot be published. */
  publish(): Offering {
    if (this.status === OFFERING_STATUS.ACTIVE) return this;
    if (this.status !== OFFERING_STATUS.DRAFT) throw invalidTransition(this.status);
    return new Offering({ ...this, status: OFFERING_STATUS.ACTIVE });
  }

  /** An archived offering frees nothing: its slug and SKUs stay taken, and it stays readable. */
  archive(): Offering {
    if (this.status === OFFERING_STATUS.ARCHIVED) throw invalidTransition(this.status);
    return new Offering({ ...this, status: OFFERING_STATUS.ARCHIVED });
  }

  private assertEditable(): void {
    if (this.status === OFFERING_STATUS.ARCHIVED) throw invalidTransition(this.status);
  }
}

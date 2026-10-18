import type { OfferingKind } from "@banijjik/contracts";
import type { Money, OfferingStatus, VariantStatus } from "@banijjik/contracts/catalog";
import type { OfferingId, UserId } from "@banijjik/ids";
import type { Offering } from "../../domain/offering.entity.js";

export interface Page<Item> {
  readonly items: readonly Item[];
  readonly hasNext: boolean;
}

/**
 * What a typed term can match: a name prefix, the offering's own synonyms, the words the
 * organization's synonym list ties to the term, an exact SKU and an exact barcode. Every text is
 * already folded like the stored `nameSearch` and `searchTerms`.
 */
export interface OfferingSearch {
  /** The typed term and every word it expands to through the organization's synonyms. */
  readonly prefixes: readonly string[];
  /** The typed term as typed (trimmed), for the exact SKU and barcode branches. */
  readonly exact: string;
}

export interface OfferingListRequest {
  readonly search?: OfferingSearch;
  readonly kind?: OfferingKind;
  readonly statuses: readonly OfferingStatus[];
  readonly categoryId?: string;
  readonly page: number;
  readonly limit: number;
}

/** A list row: no description, no custom fields, only what the price and the count need from the variants. */
export interface OfferingListRow {
  readonly offeringId: OfferingId;
  readonly kind: OfferingKind;
  readonly name: string;
  readonly slug: string;
  readonly status: OfferingStatus;
  readonly firstImageFileId: string | undefined;
  readonly variants: readonly {
    readonly variantId: string;
    readonly price: Money;
    readonly status: VariantStatus;
  }[];
  readonly categoryIds: readonly string[];
  readonly updatedAt: Date;
}

/** Persistence of offerings. Every read is scoped to the active organization by the tenant plugin. */
export interface OfferingRepository {
  /** Throws `SkuTakenError` or `SlugTakenError` when a unique index refuses the insert. */
  insert(offering: Offering): Promise<void>;
  findById(offeringId: OfferingId): Promise<Offering | undefined>;
  /** Throws like `insert`, and a 409 CONFLICT for a stale version. */
  update(offering: Offering, expectedVersion: number, actorUserId: UserId): Promise<Offering>;
  list(request: OfferingListRequest): Promise<Page<OfferingListRow>>;
  /** The slugs already used that equal `base` or start with `base-`, so the next free one can be chosen. */
  findSlugsStartingWith(base: string): Promise<ReadonlySet<string>>;
  /** The offering that holds this SKU on any variant, other than `exceptOfferingId`. */
  findOfferingIdBySku(sku: string, exceptOfferingId?: OfferingId): Promise<OfferingId | undefined>;
  /** How many ACTIVE offerings name this category. */
  countActiveInCategory(categoryId: string): Promise<number>;
}

import type { CatalogRecordStatus, Money, SynonymEntry } from "@banijjik/contracts/catalog";
import type { CategoryId, ModifierGroupId, UserId } from "@banijjik/ids";
import type { Category } from "../../domain/category.entity.js";
import type { ModifierGroup } from "../../domain/modifier-group.entity.js";
import type { Page } from "./offering-repository.js";

export interface RecordListRequest {
  readonly status: CatalogRecordStatus;
  readonly page: number;
  readonly limit: number;
}

export interface CategoryRepository {
  insert(category: Category): Promise<void>;
  findById(categoryId: CategoryId): Promise<Category | undefined>;
  update(category: Category, expectedVersion: number, actorUserId: UserId): Promise<Category>;
  /** A flat list sorted by `sortOrder` then name; the screen builds the tree. */
  list(request: RecordListRequest): Promise<Page<Category>>;
  /** The categories that exist and are ACTIVE, by id (one batched read). */
  findActiveByIds(categoryIds: readonly string[]): Promise<readonly Category[]>;
  /** The names of the categories that exist, by id (one batched read), whatever their status. */
  findNames(categoryIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
  /** The slugs already used that equal `base` or start with `base-`. */
  findSlugsStartingWith(base: string): Promise<ReadonlySet<string>>;
  /** The ids from the category's parent up to the root, nearest first. */
  findAncestorIds(categoryId: CategoryId): Promise<readonly string[]>;
  /** How many levels of ACTIVE descendants hang below the category (0 for a leaf). */
  subtreeDepth(categoryId: CategoryId): Promise<number>;
  countActiveChildren(categoryId: CategoryId): Promise<number>;
}

export interface ModifierGroupRepository {
  insert(group: ModifierGroup): Promise<void>;
  findById(modifierGroupId: ModifierGroupId): Promise<ModifierGroup | undefined>;
  update(
    group: ModifierGroup,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<ModifierGroup>;
  list(request: RecordListRequest): Promise<Page<ModifierGroup>>;
  findActiveByIds(groupIds: readonly string[]): Promise<readonly ModifierGroup[]>;
  findNames(groupIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}

/** The per-location row of an offering or a variant (ADR-005): no row means the organization defaults. */
export interface OfferingLocationRow {
  readonly offeringId: string;
  readonly variantId: string | undefined;
  readonly locationId: string;
  readonly isAvailable: boolean;
  readonly priceOverride: Money | undefined;
}

export interface OfferingLocationRepository {
  /** Creates or replaces the row for `(offeringId, variantId, locationId)`. */
  save(row: OfferingLocationRow, actorUserId: UserId): Promise<void>;
  remove(key: { offeringId: string; variantId?: string; locationId: string }): Promise<boolean>;
  /** One page of the rows of one offering, optionally of one location (the editor reads one at a time). */
  listForOffering(request: {
    readonly offeringId: string;
    readonly locationId?: string | undefined;
    readonly page: number;
    readonly limit: number;
  }): Promise<Page<OfferingLocationRow>>;
  /** The rows of one location for these offerings (one batched read). */
  forLocation(
    offeringIds: readonly string[],
    locationId: string,
  ): Promise<readonly OfferingLocationRow[]>;
}

export interface SynonymBook {
  readonly entries: readonly SynonymEntry[];
  /** 0 when the organization has none yet. */
  readonly version: number;
}

export interface SynonymRepository {
  read(): Promise<SynonymBook>;
  /** Replaces the list if `expectedVersion` is still the stored one (0 creates it); 409 otherwise. */
  write(
    entries: readonly SynonymEntry[],
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<SynonymBook>;
}

/**
 * The count of DRAFT and ACTIVE offerings, kept in one document per organization. `increment`
 * is a write, so two creates of one organization cannot both see the same count (the 3.0 quota pattern).
 */
export interface OfferingCounter {
  /** Adds one and returns the count after. */
  increment(): Promise<number>;
  decrement(): Promise<void>;
}

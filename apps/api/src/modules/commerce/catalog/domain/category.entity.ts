import {
  MAX_CATEGORY_DEPTH,
  CATALOG_RECORD_STATUS,
  type CatalogRecordStatus,
} from "@banijjik/contracts/catalog";
import { newId, type CategoryId, type OrganizationId, type UserId } from "@banijjik/ids";
import { invalidField, invalidTransition } from "./errors.js";
import type { StoredCustomFields } from "./offering.entity.js";

export interface CategoryProps {
  readonly categoryId: CategoryId;
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly slug: string;
  readonly parentCategoryId: CategoryId | undefined;
  readonly sortOrder: number;
  readonly imageFileId: string | undefined;
  readonly customFields: StoredCustomFields;
  readonly status: CatalogRecordStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
}

export interface NewCategoryInput {
  readonly categoryId: CategoryId;
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly slug: string;
  readonly parentCategoryId?: CategoryId | undefined;
  readonly sortOrder: number;
  readonly imageFileId?: string | undefined;
  readonly customFields?: StoredCustomFields | undefined;
  readonly createdByUserId: UserId;
  readonly now: Date;
}

/** The fields `PATCH /categories/{categoryId}` may change. `null` clears the parent or the image. */
export interface CategoryChanges {
  readonly name?: string;
  readonly slug?: string;
  readonly parentCategoryId?: CategoryId | null;
  readonly sortOrder?: number;
  readonly imageFileId?: string | null;
  readonly customFields?: StoredCustomFields;
}

const INITIAL_VERSION = 1;

function clearable<Value>(
  change: Value | null | undefined,
  current: Value | undefined,
): Value | undefined {
  if (change === undefined) return current;
  return change === null ? undefined : change;
}

/**
 * Where a new parent would sit: the chain of ancestors from the parent up to the root. The parent
 * chain must not contain the category itself (a cycle) and the new depth must stay within 3.
 */
export function assertParentFits(input: {
  readonly categoryId: CategoryId | undefined;
  /** The proposed parent first, then its parent, up to the root. Empty when there is no parent. */
  readonly ancestorIds: readonly string[];
  /** How many levels the category's own subtree adds below it (0 for a leaf). */
  readonly subtreeDepth: number;
}): void {
  const { categoryId, ancestorIds, subtreeDepth } = input;
  if (categoryId !== undefined && ancestorIds.includes(categoryId)) {
    throw invalidField("parentCategoryId", "errors.category_cycle");
  }
  const depth = ancestorIds.length + 1 + subtreeDepth;
  if (depth > MAX_CATEGORY_DEPTH)
    throw invalidField("parentCategoryId", "errors.category_too_deep");
}

/** A place in the catalog tree (09 section 5.3). The list is flat; the screen builds the tree. */
export class Category implements CategoryProps {
  readonly categoryId: CategoryId;
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly slug: string;
  readonly parentCategoryId: CategoryId | undefined;
  readonly sortOrder: number;
  readonly imageFileId: string | undefined;
  readonly customFields: StoredCustomFields;
  readonly status: CatalogRecordStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;

  private constructor(props: CategoryProps) {
    this.categoryId = props.categoryId;
    this.organizationId = props.organizationId;
    this.name = props.name;
    this.slug = props.slug;
    this.parentCategoryId = props.parentCategoryId;
    this.sortOrder = props.sortOrder;
    this.imageFileId = props.imageFileId;
    this.customFields = props.customFields;
    this.status = props.status;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
  }

  static newId(): CategoryId {
    return newId<CategoryId>();
  }

  static create(input: NewCategoryInput): Category {
    return new Category({
      categoryId: input.categoryId,
      organizationId: input.organizationId,
      name: input.name,
      slug: input.slug,
      parentCategoryId: input.parentCategoryId,
      sortOrder: input.sortOrder,
      imageFileId: input.imageFileId,
      customFields: input.customFields ?? { values: {}, search: [] },
      status: CATALOG_RECORD_STATUS.ACTIVE,
      version: INITIAL_VERSION,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.createdByUserId,
    });
  }

  static restore(props: CategoryProps): Category {
    return new Category(props);
  }

  withChanges(changes: CategoryChanges): Category {
    if (this.status === CATALOG_RECORD_STATUS.ARCHIVED) throw invalidTransition(this.status);
    return new Category({
      ...this,
      name: changes.name ?? this.name,
      slug: changes.slug ?? this.slug,
      parentCategoryId: clearable(changes.parentCategoryId, this.parentCategoryId),
      sortOrder: changes.sortOrder ?? this.sortOrder,
      imageFileId: clearable(changes.imageFileId, this.imageFileId),
      customFields: changes.customFields ?? this.customFields,
    });
  }

  archive(): Category {
    if (this.status === CATALOG_RECORD_STATUS.ARCHIVED) throw invalidTransition(this.status);
    return new Category({ ...this, status: CATALOG_RECORD_STATUS.ARCHIVED });
  }
}

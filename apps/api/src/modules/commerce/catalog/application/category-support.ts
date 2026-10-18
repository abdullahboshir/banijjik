import { AUDIT_ENTITY_TYPE, type AuditAction, type AuditChanges } from "@banijjik/contracts";
import { publicFilePath } from "@banijjik/contracts/file";
import type { CategoryResponse } from "@banijjik/contracts/catalog";
import type { CategoryId } from "@banijjik/ids";
import { diffAuditFields, type AuditFields } from "../../../../kernel/audit/index.js";
import { assertParentFits, type Category } from "../domain/category.entity.js";
import { invalidField, referenceInvalid } from "../domain/errors.js";
import type { CatalogDependencies } from "./catalog-dependencies.js";
import { readableCustomFields } from "./custom-field-values.js";
import type { EffectiveCustomField } from "@banijjik/contracts";

const IMAGE_VARIANT = "medium";

function categoryFields(category: Category | undefined): AuditFields {
  if (category === undefined) return {};
  return {
    name: category.name,
    slug: category.slug,
    parentCategoryId: category.parentCategoryId,
    sortOrder: category.sortOrder,
    imageFileId: category.imageFileId,
    status: category.status,
  };
}

export function categoryAuditChanges(before: Category | undefined, after: Category): AuditChanges {
  return diffAuditFields(categoryFields(before), categoryFields(after));
}

export function recordCategory(
  dependencies: Pick<CatalogDependencies, "audit">,
  entry: {
    action: AuditAction;
    before: Category | undefined;
    after: Category;
    extra?: AuditChanges;
  },
): Promise<void> {
  return dependencies.audit.record({
    action: entry.action,
    entityType: AUDIT_ENTITY_TYPE.category,
    entityId: entry.after.categoryId,
    changes: { ...categoryAuditChanges(entry.before, entry.after), ...entry.extra },
  });
}

export function viewCategory(
  category: Category,
  fields: readonly EffectiveCustomField[],
  canReadSensitive: boolean,
): CategoryResponse {
  return {
    categoryId: category.categoryId,
    name: category.name,
    slug: category.slug,
    parentCategoryId: category.parentCategoryId ?? null,
    sortOrder: category.sortOrder,
    imageFileId: category.imageFileId ?? null,
    imageUrl:
      category.imageFileId === undefined
        ? null
        : publicFilePath(category.imageFileId, IMAGE_VARIANT),
    customFields: readableCustomFields({
      stored: category.customFields.values,
      fields,
      canReadSensitive,
    }),
    status: category.status,
    version: category.version,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

/**
 * The new parent must be an ACTIVE category of this organization, and the tree must stay within
 * three levels without a cycle (400 at `parentCategoryId`). `categoryId` is absent on create.
 */
export async function assertParentUsable(
  categories: Pick<
    CatalogDependencies["categories"],
    "findActiveByIds" | "findAncestorIds" | "subtreeDepth"
  >,
  input: { readonly categoryId: CategoryId | undefined; readonly parentCategoryId: CategoryId },
): Promise<void> {
  const [parent] = await categories.findActiveByIds([input.parentCategoryId]);
  if (parent === undefined) throw referenceInvalid("parentCategoryId");
  if (input.parentCategoryId === input.categoryId) {
    throw invalidField("parentCategoryId", "errors.category_cycle");
  }
  const above = await categories.findAncestorIds(input.parentCategoryId);
  assertParentFits({
    categoryId: input.categoryId,
    ancestorIds: [input.parentCategoryId, ...above],
    subtreeDepth:
      input.categoryId === undefined ? 0 : await categories.subtreeDepth(input.categoryId),
  });
}

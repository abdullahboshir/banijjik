import type { CurrencyCode } from "@banijjik/contracts";
import {
  asId,
  type CategoryId,
  type ModifierGroupId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import { stripMongoInternals } from "../../../../kernel/db/index.js";
import { Category } from "../domain/category.entity.js";
import { ModifierGroup } from "../domain/modifier-group.entity.js";
import type { CategoryDocument, ModifierGroupDocument } from "./record.schemas.js";

function creatorOf(value: string | null): UserId | null {
  return value === null ? null : asId<UserId>(value);
}

export type EditableCategoryFields = Pick<
  CategoryDocument,
  "name" | "slug" | "sortOrder" | "status" | "customFields" | "customFieldSearch"
>;

export type EditableModifierGroupFields = Pick<
  ModifierGroupDocument,
  "name" | "selection" | "isRequired" | "minSelect" | "maxSelect" | "options" | "status"
>;

export function categoryEditableFields(category: Category): EditableCategoryFields {
  return {
    name: category.name,
    slug: category.slug,
    sortOrder: category.sortOrder,
    status: category.status,
    customFields: { ...category.customFields.values },
    customFieldSearch: category.customFields.search.map((entry) => ({ ...entry })),
  };
}

export function toCategoryDocument(category: Category): CategoryDocument {
  return {
    categoryId: category.categoryId,
    organizationId: category.organizationId,
    ...categoryEditableFields(category),
    version: category.version,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    createdByUserId: category.createdByUserId,
    updatedByUserId: null,
    ...(category.parentCategoryId === undefined
      ? {}
      : { parentCategoryId: category.parentCategoryId }),
    ...(category.imageFileId === undefined ? {} : { imageFileId: category.imageFileId }),
  };
}

export function toCategory(document: CategoryDocument): Category {
  const stored = stripMongoInternals(document);
  return Category.restore({
    categoryId: asId<CategoryId>(stored.categoryId),
    organizationId: asId<OrganizationId>(stored.organizationId),
    name: stored.name,
    slug: stored.slug,
    parentCategoryId:
      stored.parentCategoryId === undefined ? undefined : asId<CategoryId>(stored.parentCategoryId),
    sortOrder: stored.sortOrder,
    imageFileId: stored.imageFileId,
    customFields: { values: stored.customFields ?? {}, search: stored.customFieldSearch ?? [] },
    status: stored.status,
    version: stored.version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    createdByUserId: creatorOf(stored.createdByUserId),
  });
}

export function modifierGroupEditableFields(group: ModifierGroup): EditableModifierGroupFields {
  return {
    name: group.name,
    selection: group.selection,
    isRequired: group.isRequired,
    minSelect: group.minSelect,
    maxSelect: group.maxSelect,
    options: group.options.map((option) => ({ ...option, priceDelta: { ...option.priceDelta } })),
    status: group.status,
  };
}

export function toModifierGroupDocument(group: ModifierGroup): ModifierGroupDocument {
  return {
    modifierGroupId: group.modifierGroupId,
    organizationId: group.organizationId,
    ...modifierGroupEditableFields(group),
    version: group.version,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    createdByUserId: group.createdByUserId,
    updatedByUserId: null,
  };
}

export function toModifierGroup(document: ModifierGroupDocument): ModifierGroup {
  const stored = stripMongoInternals(document);
  return ModifierGroup.restore({
    modifierGroupId: asId<ModifierGroupId>(stored.modifierGroupId),
    organizationId: asId<OrganizationId>(stored.organizationId),
    name: stored.name,
    selection: stored.selection,
    isRequired: stored.isRequired,
    minSelect: stored.minSelect,
    maxSelect: stored.maxSelect,
    options: stored.options.map((option) => ({
      modifierOptionId: option.modifierOptionId,
      name: option.name,
      priceDelta: {
        amount: option.priceDelta.amount,
        currency: option.priceDelta.currency as CurrencyCode,
      },
      status: option.status,
    })),
    status: stored.status,
    version: stored.version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    createdByUserId: creatorOf(stored.createdByUserId),
  });
}

import { AUDIT_ACTION, type EffectiveCustomField } from "@banijjik/contracts";
import type { CatalogRecordStatus, CategoryResponse } from "@banijjik/contracts/catalog";
import type { CategoryId, OrganizationId, UserId } from "@banijjik/ids";
import { Category, type CategoryChanges } from "../../domain/category.entity.js";
import { categoryInUse, recordNotFound, slugTaken } from "../../domain/errors.js";
import { firstFreeSlug, slugFromName } from "../../domain/slug.js";
import type { CatalogDependencies } from "../catalog-dependencies.js";
import { assertImageUsable } from "../catalog-references.js";
import { assertParentUsable, recordCategory, viewCategory } from "../category-support.js";
import { mergeCustomFieldValues, type MergedCustomFields } from "../custom-field-values.js";
import type { Page } from "../ports/offering-repository.js";

interface Actor {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
}

export interface CreateCategoryInput extends Actor {
  readonly name: string;
  readonly slug?: string | undefined;
  readonly parentCategoryId?: CategoryId | undefined;
  readonly sortOrder: number;
  readonly imageFileId?: string | undefined;
  readonly customFields?: Readonly<Record<string, unknown>> | undefined;
}

export interface UpdateCategoryInput extends Actor {
  readonly categoryId: CategoryId;
  readonly version: number;
  readonly name?: string | undefined;
  readonly slug?: string | undefined;
  readonly parentCategoryId?: CategoryId | null | undefined;
  readonly sortOrder?: number | undefined;
  readonly imageFileId?: string | null | undefined;
  readonly customFields?: Readonly<Record<string, unknown>> | undefined;
}

async function chooseCategorySlug(
  categories: CatalogDependencies["categories"],
  input: { name: string; explicit: string | undefined; categoryId: CategoryId; current?: string },
): Promise<string> {
  if (input.explicit !== undefined) {
    if (input.explicit === input.current) return input.explicit;
    const taken = await categories.findSlugsStartingWith(input.explicit);
    if (taken.has(input.explicit)) throw slugTaken(input.explicit);
    return input.explicit;
  }
  const base = slugFromName(input.name, { prefix: "c", recordId: input.categoryId });
  return firstFreeSlug(base, await categories.findSlugsStartingWith(base));
}

/** Adds a category. The tree stays within three levels without a cycle. */
export class CreateCategoryUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(input: CreateCategoryInput): Promise<CategoryResponse> {
    const { categories, customFields, images, unitOfWork, clock, sensitiveAccess } =
      this.dependencies;
    const fields = await customFields.forCategory(input.organizationId);
    if (input.imageFileId !== undefined) await assertImageUsable(images, input.imageFileId);
    const categoryId = Category.newId();
    if (input.parentCategoryId !== undefined) {
      await assertParentUsable(categories, {
        categoryId: undefined,
        parentCategoryId: input.parentCategoryId,
      });
    }
    const slug = await this.slugOf(input, categoryId);
    const saved = await unitOfWork.run(async () => {
      const merged = mergeCustomFieldValues({
        stored: {},
        requested: input.customFields ?? {},
        fields,
        mode: "CREATE",
        canWriteSensitive: await sensitiveAccess.maySeeSensitive(),
      });
      const category = Category.create({
        categoryId,
        organizationId: input.organizationId,
        name: input.name,
        slug,
        parentCategoryId: input.parentCategoryId,
        sortOrder: input.sortOrder,
        imageFileId: input.imageFileId,
        customFields: merged,
        createdByUserId: input.actorUserId,
        now: clock.now(),
      });
      await categories.insert(category);
      await recordCategory(this.dependencies, {
        action: AUDIT_ACTION.CATEGORY_CREATED,
        before: undefined,
        after: category,
        extra: merged.auditChanges,
      });
      return category;
    });
    return viewCategory(saved, fields, await this.dependencies.sensitiveAccess.maySeeSensitive());
  }

  private slugOf(input: CreateCategoryInput, categoryId: CategoryId): Promise<string> {
    return chooseCategorySlug(this.dependencies.categories, {
      name: input.name,
      explicit: input.slug,
      categoryId,
    });
  }
}

/** Edits a category; moving it under another parent re-checks the depth and cycles. */
export class UpdateCategoryUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(input: UpdateCategoryInput): Promise<CategoryResponse> {
    const { categories, customFields, images, unitOfWork } = this.dependencies;
    const fields = await customFields.forCategory(input.organizationId);
    if (typeof input.imageFileId === "string") await assertImageUsable(images, input.imageFileId);
    if (typeof input.parentCategoryId === "string") {
      await assertParentUsable(categories, {
        categoryId: input.categoryId,
        parentCategoryId: input.parentCategoryId,
      });
    }
    const saved = await unitOfWork.run(() => this.updateInside(input, fields));
    return viewCategory(saved, fields, await this.dependencies.sensitiveAccess.maySeeSensitive());
  }

  private async updateInside(
    input: UpdateCategoryInput,
    fields: readonly EffectiveCustomField[],
  ): Promise<Category> {
    const { categories, sensitiveAccess } = this.dependencies;
    const existing = await categories.findById(input.categoryId);
    if (existing === undefined) throw recordNotFound();
    const merged: MergedCustomFields | undefined =
      input.customFields === undefined
        ? undefined
        : mergeCustomFieldValues({
            stored: existing.customFields.values,
            requested: input.customFields,
            fields,
            mode: "UPDATE",
            canWriteSensitive: await sensitiveAccess.maySeeSensitive(),
          });
    const changes = await this.changesOf(input, existing, merged);
    const edited = existing.withChanges(changes);
    const updated = await categories.update(edited, input.version, input.actorUserId);
    await recordCategory(this.dependencies, {
      action: AUDIT_ACTION.CATEGORY_UPDATED,
      before: existing,
      after: updated,
      ...(merged === undefined ? {} : { extra: merged.auditChanges }),
    });
    return updated;
  }

  private async changesOf(
    input: UpdateCategoryInput,
    existing: Category,
    merged: MergedCustomFields | undefined,
  ): Promise<CategoryChanges> {
    const slug =
      input.slug === undefined
        ? undefined
        : await chooseCategorySlug(this.dependencies.categories, {
            name: input.name ?? existing.name,
            explicit: input.slug,
            categoryId: existing.categoryId,
            current: existing.slug,
          });
    return {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(slug === undefined ? {} : { slug }),
      ...(input.parentCategoryId === undefined ? {} : { parentCategoryId: input.parentCategoryId }),
      ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      ...(input.imageFileId === undefined ? {} : { imageFileId: input.imageFileId }),
      ...(merged === undefined ? {} : { customFields: merged }),
    };
  }
}

/** Refused while ACTIVE offerings or ACTIVE child categories use it (422, with the counts). */
export class ArchiveCategoryUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(
    input: Actor & { readonly categoryId: CategoryId; readonly version: number },
  ): Promise<CategoryResponse> {
    const { categories, offerings, customFields, unitOfWork } = this.dependencies;
    const fields = await customFields.forCategory(input.organizationId);
    const saved = await unitOfWork.run(async () => {
      const existing = await categories.findById(input.categoryId);
      if (existing === undefined) throw recordNotFound();
      const archived = existing.archive();
      const [offeringCount, childCount] = await Promise.all([
        offerings.countActiveInCategory(input.categoryId),
        categories.countActiveChildren(input.categoryId),
      ]);
      if (offeringCount > 0 || childCount > 0) {
        throw categoryInUse({ offerings: offeringCount, childCategories: childCount });
      }
      const updated = await categories.update(archived, input.version, input.actorUserId);
      await recordCategory(this.dependencies, {
        action: AUDIT_ACTION.CATEGORY_ARCHIVED,
        before: existing,
        after: updated,
      });
      return updated;
    });
    return viewCategory(saved, fields, await this.dependencies.sensitiveAccess.maySeeSensitive());
  }
}

export type CategoryReadDependencies = Pick<
  CatalogDependencies,
  "categories" | "customFields" | "sensitiveAccess"
>;

/** One category. */
export class GetCategoryUseCase {
  constructor(private readonly dependencies: CategoryReadDependencies) {}

  async execute(
    input: Pick<Actor, "organizationId"> & { readonly categoryId: CategoryId },
  ): Promise<CategoryResponse> {
    const category = await this.dependencies.categories.findById(input.categoryId);
    if (category === undefined) throw recordNotFound();
    const fields = await this.dependencies.customFields.forCategory(input.organizationId);
    return viewCategory(
      category,
      fields,
      await this.dependencies.sensitiveAccess.maySeeSensitive(),
    );
  }
}

/** A flat page sorted by `sortOrder`; the screen builds the tree. */
export class ListCategoriesUseCase {
  constructor(private readonly dependencies: CategoryReadDependencies) {}

  async execute(
    input: Pick<Actor, "organizationId"> & {
      readonly status: CatalogRecordStatus;
      readonly page: number;
      readonly limit: number;
    },
  ): Promise<Page<CategoryResponse>> {
    const { categories, customFields } = this.dependencies;
    const [page, fields] = await Promise.all([
      categories.list({ status: input.status, page: input.page, limit: input.limit }),
      customFields.forCategory(input.organizationId),
    ]);
    const canReadSensitive = await this.dependencies.sensitiveAccess.maySeeSensitive();
    const items = page.items.map((category) => viewCategory(category, fields, canReadSensitive));
    return { items, hasNext: page.hasNext };
  }
}

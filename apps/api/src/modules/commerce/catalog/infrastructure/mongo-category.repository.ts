import { CATALOG_RECORD_STATUS } from "@banijjik/contracts/catalog";
import type { CategoryId, UserId } from "@banijjik/ids";
import { escapeRegExp } from "@banijjik/validation";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type { Page } from "../application/ports/offering-repository.js";
import type { CategoryRepository, RecordListRequest } from "../application/ports/record-ports.js";
import type { Category } from "../domain/category.entity.js";
import { SlugTakenError } from "../domain/errors.js";
import { categoryEditableFields, toCategory, toCategoryDocument } from "./record.mappers.js";
import { CATEGORY_MODEL_NAME, type CategoryDocument } from "./record.schemas.js";

const LIST_SORT = { sortOrder: 1, name: 1, categoryId: 1 } as const;
const MAX_TREE_LEVELS = 4;

/** Categories belong to the organization; the tenant plugin adds the organization filter (ADR-087). */
export class MongoCategoryRepository implements CategoryRepository {
  async insert(category: Category): Promise<void> {
    try {
      await this.model().create([toCategoryDocument(category)], sessionOption(getActiveSession()));
    } catch (error) {
      throw asSlugRefusal(error);
    }
  }

  async findById(categoryId: CategoryId): Promise<Category | undefined> {
    const document = await this.model()
      .findOne({ categoryId }, null, sessionOption(getActiveSession()))
      .lean<CategoryDocument>();
    return document === null ? undefined : toCategory(document);
  }

  async update(
    category: Category,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<Category> {
    const unset = {
      ...(category.parentCategoryId === undefined ? { parentCategoryId: 1 } : {}),
      ...(category.imageFileId === undefined ? { imageFileId: 1 } : {}),
    };
    try {
      const saved = await updateVersioned<CategoryDocument>({
        model: this.model(),
        filter: { categoryId: category.categoryId },
        expectedVersion,
        update: {
          $set: {
            ...categoryEditableFields(category),
            updatedByUserId: actorUserId,
            ...(category.parentCategoryId === undefined
              ? {}
              : { parentCategoryId: category.parentCategoryId }),
            ...(category.imageFileId === undefined ? {} : { imageFileId: category.imageFileId }),
          },
          ...(Object.keys(unset).length === 0 ? {} : { $unset: unset }),
        },
      });
      return toCategory(saved);
    } catch (error) {
      throw asSlugRefusal(error);
    }
  }

  async list(request: RecordListRequest): Promise<Page<Category>> {
    const { page, limit, status } = request;
    const documents = await this.model()
      .find({ status }, null, sessionOption(getActiveSession()))
      .sort(LIST_SORT)
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .lean<CategoryDocument[]>();
    return { items: documents.slice(0, limit).map(toCategory), hasNext: documents.length > limit };
  }

  async findActiveByIds(categoryIds: readonly string[]): Promise<readonly Category[]> {
    if (categoryIds.length === 0) return [];
    const documents = await this.model()
      .find(
        { categoryId: { $in: categoryIds }, status: CATALOG_RECORD_STATUS.ACTIVE },
        null,
        sessionOption(getActiveSession()),
      )
      .lean<CategoryDocument[]>();
    return documents.map(toCategory);
  }

  async findNames(categoryIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    if (categoryIds.length === 0) return new Map();
    const documents = await this.model()
      .find(
        { categoryId: { $in: categoryIds } },
        { _id: 0, categoryId: 1, name: 1 },
        sessionOption(getActiveSession()),
      )
      .lean<Pick<CategoryDocument, "categoryId" | "name">[]>();
    return new Map(documents.map((document) => [document.categoryId, document.name]));
  }

  async findSlugsStartingWith(base: string): Promise<ReadonlySet<string>> {
    const documents = await this.model()
      .find(
        { slug: { $regex: `^${escapeRegExp(base)}(-\\d+)?$` } },
        { _id: 0, slug: 1 },
        sessionOption(getActiveSession()),
      )
      .lean<Pick<CategoryDocument, "slug">[]>();
    return new Set(documents.map((document) => document.slug));
  }

  async findAncestorIds(categoryId: CategoryId): Promise<readonly string[]> {
    const ancestors: string[] = [];
    let current = await this.parentOf(categoryId);
    // The tree is at most three levels deep; the bound also stops a corrupt cycle.
    while (current !== undefined && ancestors.length < MAX_TREE_LEVELS) {
      ancestors.push(current);
      current = await this.parentOf(current);
    }
    return ancestors;
  }

  async subtreeDepth(categoryId: CategoryId): Promise<number> {
    let depth = 0;
    let level: readonly string[] = [categoryId];
    while (level.length > 0 && depth < MAX_TREE_LEVELS) {
      const children = await this.activeChildrenOf(level);
      if (children.length === 0) break;
      depth += 1;
      level = children;
    }
    return depth;
  }

  countActiveChildren(categoryId: CategoryId): Promise<number> {
    return this.model()
      .countDocuments({ parentCategoryId: categoryId, status: CATALOG_RECORD_STATUS.ACTIVE })
      .session(getActiveSession() ?? null)
      .exec();
  }

  private async parentOf(categoryId: string): Promise<string | undefined> {
    const document = await this.model()
      .findOne({ categoryId }, { _id: 0, parentCategoryId: 1 }, sessionOption(getActiveSession()))
      .lean<Pick<CategoryDocument, "parentCategoryId">>();
    return document?.parentCategoryId;
  }

  private async activeChildrenOf(parentIds: readonly string[]): Promise<string[]> {
    const documents = await this.model()
      .find(
        { parentCategoryId: { $in: parentIds }, status: CATALOG_RECORD_STATUS.ACTIVE },
        { _id: 0, categoryId: 1 },
        sessionOption(getActiveSession()),
      )
      .lean<Pick<CategoryDocument, "categoryId">[]>();
    return documents.map((document) => document.categoryId);
  }

  private model() {
    return models({}).get<CategoryDocument>(CATEGORY_MODEL_NAME);
  }
}

function asSlugRefusal(error: unknown): unknown {
  if (!isDuplicateKeyError(error, "slug")) return error;
  const keyValue = (error as { keyValue?: Record<string, unknown> }).keyValue;
  const slug = keyValue?.["slug"];
  return new SlugTakenError(typeof slug === "string" ? slug : "");
}

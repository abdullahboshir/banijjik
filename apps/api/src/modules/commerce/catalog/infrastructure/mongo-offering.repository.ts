import type { OfferingKind } from "@banijjik/contracts";
import type { OfferingStatus } from "@banijjik/contracts/catalog";
import { OFFERING_STATUS } from "@banijjik/contracts/catalog";
import { asId, type OfferingId, type UserId } from "@banijjik/ids";
import { escapeRegExp } from "@banijjik/validation";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type {
  OfferingListRequest,
  OfferingListRow,
  OfferingRepository,
  OfferingSearch,
  Page,
} from "../application/ports/offering-repository.js";
import { SkuTakenError, SlugTakenError } from "../domain/errors.js";
import type { Offering } from "../domain/offering.entity.js";
import { offeringEditableFields, toOffering, toOfferingDocument } from "./offering.mapper.js";
import { OFFERING_MODEL_NAME, type OfferingDocument } from "./offering.schema.js";

const LIST_SORT = { updatedAt: -1, offeringId: 1 } as const;
const LIST_PROJECTION = {
  _id: 0,
  offeringId: 1,
  kind: 1,
  name: 1,
  slug: 1,
  status: 1,
  imageFileIds: { $slice: 1 },
  "variants.variantId": 1,
  "variants.price": 1,
  "variants.status": 1,
  categoryIds: 1,
  updatedAt: 1,
} as const;

type ListDocument = Pick<
  OfferingDocument,
  "offeringId" | "kind" | "name" | "slug" | "status" | "categoryIds" | "updatedAt"
> & {
  imageFileIds?: string[];
  variants: { variantId: string; price: { amount: number; currency: string }; status: string }[];
};

type Condition = Record<string, unknown>;

function prefixOf(text: string): { $regex: string } {
  return { $regex: `^${escapeRegExp(text)}` };
}

/** Each branch is backed by its own index; an unindexed branch would turn the whole `$or` into a collection scan. */
function searchBranches(search: OfferingSearch): Condition[] {
  const branches: Condition[] = [];
  for (const prefix of search.prefixes) {
    branches.push({ nameSearch: prefixOf(prefix) }, { searchTerms: prefixOf(prefix) });
  }
  branches.push({ "variants.sku": search.exact }, { "variants.barcode": search.exact });
  return branches;
}

/** The query of `GET /offerings` (the tenant plugin adds the organization). */
export function buildOfferingFilter(request: OfferingListRequest): Condition {
  const conditions: Condition[] = [{ status: { $in: [...request.statuses] } }];
  if (request.kind !== undefined) conditions.push({ kind: request.kind });
  if (request.categoryId !== undefined) conditions.push({ categoryIds: request.categoryId });
  if (request.search !== undefined) conditions.push({ $or: searchBranches(request.search) });
  return { $and: conditions };
}

function toListRow(document: ListDocument): OfferingListRow {
  return {
    offeringId: asId<OfferingId>(document.offeringId),
    kind: document.kind as OfferingKind,
    name: document.name,
    slug: document.slug,
    status: document.status as OfferingStatus,
    firstImageFileId: document.imageFileIds?.[0],
    variants: document.variants.map((variant) => ({
      variantId: variant.variantId,
      price: { amount: variant.price.amount, currency: variant.price.currency as "BDT" },
      status: variant.status as "ACTIVE" | "ARCHIVED",
    })),
    categoryIds: document.categoryIds,
    updatedAt: document.updatedAt,
  };
}

/** A duplicate-key error names the SKU or slug that was refused; the domain error carries it. */
function asIndexRefusal(error: unknown): unknown {
  if (isDuplicateKeyError(error, "slug")) return new SlugTakenError(valueOf(error, "slug"));
  if (isDuplicateKeyError(error, "variants.sku")) {
    return new SkuTakenError(valueOf(error, "variants.sku"));
  }
  return error;
}

function valueOf(error: unknown, key: string): string {
  const keyValue = (error as { keyValue?: Record<string, unknown> }).keyValue;
  const value = keyValue?.[key];
  return typeof value === "string" ? value : "";
}

/**
 * A tenant model: inside a request or an organization context the plugin adds the organization
 * filter to every query, so an offering of another organization is simply not found.
 */
export class MongoOfferingRepository implements OfferingRepository {
  async insert(offering: Offering): Promise<void> {
    try {
      await this.model().create([toOfferingDocument(offering)], sessionOption(getActiveSession()));
    } catch (error) {
      throw asIndexRefusal(error);
    }
  }

  async findById(offeringId: OfferingId): Promise<Offering | undefined> {
    const document = await this.model()
      .findOne({ offeringId }, null, sessionOption(getActiveSession()))
      .lean<OfferingDocument>();
    return document === null ? undefined : toOffering(document);
  }

  async update(
    offering: Offering,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<Offering> {
    const unset = {
      ...(offering.description === undefined ? { description: 1 } : {}),
      ...(offering.taxClassKey === undefined ? { taxClassKey: 1 } : {}),
    };
    try {
      const saved = await updateVersioned<OfferingDocument>({
        model: this.model(),
        filter: { offeringId: offering.offeringId },
        expectedVersion,
        update: {
          $set: {
            ...offeringEditableFields(offering),
            updatedByUserId: actorUserId,
            ...(offering.description === undefined ? {} : { description: offering.description }),
            ...(offering.taxClassKey === undefined ? {} : { taxClassKey: offering.taxClassKey }),
          },
          // An empty $unset is refused by MongoDB.
          ...(Object.keys(unset).length === 0 ? {} : { $unset: unset }),
        },
      });
      return toOffering(saved);
    } catch (error) {
      throw asIndexRefusal(error);
    }
  }

  async list(request: OfferingListRequest): Promise<Page<OfferingListRow>> {
    const { page, limit } = request;
    // One extra row tells whether another page exists, without counting the collection.
    const documents = await this.model()
      .find(buildOfferingFilter(request), LIST_PROJECTION, sessionOption(getActiveSession()))
      .sort(LIST_SORT)
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .lean<ListDocument[]>();
    return { items: documents.slice(0, limit).map(toListRow), hasNext: documents.length > limit };
  }

  async findSlugsStartingWith(base: string): Promise<ReadonlySet<string>> {
    const documents = await this.model()
      .find(
        { slug: { $regex: `^${escapeRegExp(base)}(-\\d+)?$` } },
        { _id: 0, slug: 1 },
        sessionOption(getActiveSession()),
      )
      .lean<Pick<OfferingDocument, "slug">[]>();
    return new Set(documents.map((document) => document.slug));
  }

  async findOfferingIdBySku(
    sku: string,
    exceptOfferingId?: OfferingId,
  ): Promise<OfferingId | undefined> {
    const document = await this.model()
      .findOne(
        {
          "variants.sku": sku,
          ...(exceptOfferingId === undefined ? {} : { offeringId: { $ne: exceptOfferingId } }),
        },
        { _id: 0, offeringId: 1 },
        sessionOption(getActiveSession()),
      )
      .lean<Pick<OfferingDocument, "offeringId">>();
    return document === null ? undefined : asId<OfferingId>(document.offeringId);
  }

  countActiveInCategory(categoryId: string): Promise<number> {
    return this.model()
      .countDocuments({ categoryIds: categoryId, status: OFFERING_STATUS.ACTIVE })
      .session(getActiveSession() ?? null)
      .exec();
  }

  private model() {
    return models({}).get<OfferingDocument>(OFFERING_MODEL_NAME);
  }
}

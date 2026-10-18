import type { SynonymEntry } from "@banijjik/contracts/catalog";
import { CATALOG_RECORD_STATUS } from "@banijjik/contracts/catalog";
import { newId, type ModifierGroupId, type UserId } from "@banijjik/ids";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import { conflict } from "../../../../kernel/http/index.js";
import type { Page } from "../application/ports/offering-repository.js";
import type {
  ModifierGroupRepository,
  OfferingCounter,
  OfferingLocationRepository,
  OfferingLocationRow,
  RecordListRequest,
  SynonymBook,
  SynonymRepository,
} from "../application/ports/record-ports.js";
import type { ModifierGroup } from "../domain/modifier-group.entity.js";
import {
  modifierGroupEditableFields,
  toModifierGroup,
  toModifierGroupDocument,
} from "./record.mappers.js";
import {
  MODIFIER_GROUP_MODEL_NAME,
  OFFERING_COUNTER_MODEL_NAME,
  OFFERING_LOCATION_MODEL_NAME,
  SYNONYM_BOOK_MODEL_NAME,
  type ModifierGroupDocument,
  type OfferingCounterDocument,
  type OfferingLocationDocument,
  type SynonymBookDocument,
} from "./record.schemas.js";

const LIST_SORT = { updatedAt: -1, modifierGroupId: 1 } as const;

export class MongoModifierGroupRepository implements ModifierGroupRepository {
  async insert(group: ModifierGroup): Promise<void> {
    await this.model().create([toModifierGroupDocument(group)], sessionOption(getActiveSession()));
  }

  async findById(modifierGroupId: ModifierGroupId): Promise<ModifierGroup | undefined> {
    const document = await this.model()
      .findOne({ modifierGroupId }, null, sessionOption(getActiveSession()))
      .lean<ModifierGroupDocument>();
    return document === null ? undefined : toModifierGroup(document);
  }

  async update(
    group: ModifierGroup,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<ModifierGroup> {
    const saved = await updateVersioned<ModifierGroupDocument>({
      model: this.model(),
      filter: { modifierGroupId: group.modifierGroupId },
      expectedVersion,
      update: { $set: { ...modifierGroupEditableFields(group), updatedByUserId: actorUserId } },
    });
    return toModifierGroup(saved);
  }

  async list(request: RecordListRequest): Promise<Page<ModifierGroup>> {
    const { page, limit, status } = request;
    const documents = await this.model()
      .find({ status }, null, sessionOption(getActiveSession()))
      .sort(LIST_SORT)
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .lean<ModifierGroupDocument[]>();
    return {
      items: documents.slice(0, limit).map(toModifierGroup),
      hasNext: documents.length > limit,
    };
  }

  async findActiveByIds(groupIds: readonly string[]): Promise<readonly ModifierGroup[]> {
    if (groupIds.length === 0) return [];
    const documents = await this.model()
      .find(
        { modifierGroupId: { $in: groupIds }, status: CATALOG_RECORD_STATUS.ACTIVE },
        null,
        sessionOption(getActiveSession()),
      )
      .lean<ModifierGroupDocument[]>();
    return documents.map(toModifierGroup);
  }

  async findNames(groupIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    if (groupIds.length === 0) return new Map();
    const documents = await this.model()
      .find(
        { modifierGroupId: { $in: groupIds } },
        { _id: 0, modifierGroupId: 1, name: 1 },
        sessionOption(getActiveSession()),
      )
      .lean<Pick<ModifierGroupDocument, "modifierGroupId" | "name">[]>();
    return new Map(documents.map((document) => [document.modifierGroupId, document.name]));
  }

  private model() {
    return models({}).get<ModifierGroupDocument>(MODIFIER_GROUP_MODEL_NAME);
  }
}

function locationKey(key: {
  offeringId: string;
  variantId?: string | undefined;
  locationId: string;
}) {
  return {
    offeringId: key.offeringId,
    variantId: key.variantId ?? null,
    locationId: key.locationId,
  };
}

/** Per-location rows are ORGANIZATION_AND_LOCATION: the plugin also keeps them inside the caller's locations. */
export class MongoOfferingLocationRepository implements OfferingLocationRepository {
  /**
   * Updates the row, or inserts it when there is none. Not an upsert: for a caller limited to some
   * locations the tenant plugin adds its own `locationId` condition, which MongoDB cannot combine
   * with the key's `locationId` when it has to build the new document.
   */
  async save(row: OfferingLocationRow, actorUserId: UserId): Promise<void> {
    const session = sessionOption(getActiveSession());
    const isUpdated = async (): Promise<boolean> => {
      const result = await this.model().updateOne(
        locationKey(row),
        {
          $set: {
            isAvailable: row.isAvailable,
            updatedByUserId: actorUserId,
            ...(row.priceOverride === undefined ? {} : { priceOverride: { ...row.priceOverride } }),
          },
          ...(row.priceOverride === undefined ? { $unset: { priceOverride: 1 } } : {}),
          $inc: { version: 1 },
        },
        session,
      );
      return result.matchedCount > 0;
    };
    if (await isUpdated()) return;
    try {
      await this.model().create(
        [
          {
            offeringLocationId: newId(),
            ...locationKey(row),
            isAvailable: row.isAvailable,
            ...(row.priceOverride === undefined ? {} : { priceOverride: { ...row.priceOverride } }),
            version: 1,
            createdByUserId: actorUserId,
            updatedByUserId: actorUserId,
          },
        ],
        session,
      );
    } catch (error) {
      // Two writers inserted at once: the other one's row exists now, so this write is an update.
      if (!isDuplicateKeyError(error) || !(await isUpdated())) throw error;
    }
  }

  async remove(key: {
    offeringId: string;
    variantId?: string;
    locationId: string;
  }): Promise<boolean> {
    const result = await this.model().deleteOne(
      locationKey(key),
      sessionOption(getActiveSession()),
    );
    return result.deletedCount > 0;
  }

  async forLocation(
    offeringIds: readonly string[],
    locationId: string,
  ): Promise<readonly OfferingLocationRow[]> {
    if (offeringIds.length === 0) return [];
    const documents = await this.model()
      .find(
        { offeringId: { $in: offeringIds }, locationId },
        null,
        sessionOption(getActiveSession()),
      )
      .lean<OfferingLocationDocument[]>();
    return documents.map((document) => ({
      offeringId: document.offeringId,
      variantId: document.variantId ?? undefined,
      locationId: document.locationId,
      isAvailable: document.isAvailable,
      priceOverride:
        document.priceOverride === undefined
          ? undefined
          : {
              amount: document.priceOverride.amount,
              currency: document.priceOverride.currency as "BDT",
            },
    }));
  }

  private model() {
    return models({}).get<OfferingLocationDocument>(OFFERING_LOCATION_MODEL_NAME);
  }
}

/** One document per organization, created on the first write. */
export class MongoSynonymRepository implements SynonymRepository {
  async read(): Promise<SynonymBook> {
    const document = await this.model()
      .findOne({}, null, sessionOption(getActiveSession()))
      .lean<SynonymBookDocument>();
    if (document === null) return { entries: [], version: 0 };
    return { entries: document.entries, version: document.version };
  }

  async write(
    entries: readonly SynonymEntry[],
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<SynonymBook> {
    const stored = entries.map((entry) => ({ term: entry.term, synonyms: [...entry.synonyms] }));
    if (expectedVersion === 0) return this.create(stored, actorUserId);
    const saved = await updateVersioned<SynonymBookDocument>({
      model: this.model(),
      filter: {},
      expectedVersion,
      update: { $set: { entries: stored, updatedByUserId: actorUserId } },
    });
    return { entries: saved.entries, version: saved.version };
  }

  private async create(
    entries: SynonymBookDocument["entries"],
    actorUserId: UserId,
  ): Promise<SynonymBook> {
    try {
      await this.model().create(
        [
          {
            searchSynonymId: newId(),
            entries,
            version: 1,
            createdByUserId: actorUserId,
            updatedByUserId: actorUserId,
          },
        ],
        sessionOption(getActiveSession()),
      );
    } catch (error) {
      // The organization already has a list: the caller wrote against a stale version 0.
      if (isDuplicateKeyError(error))
        throw conflict({ currentVersion: (await this.read()).version });
      throw error;
    }
    return { entries, version: 1 };
  }

  private model() {
    return models({}).get<SynonymBookDocument>(SYNONYM_BOOK_MODEL_NAME);
  }
}

/** The package-limit counter. Every increment is a write, so two creates of one organization cannot both read the same count. */
export class MongoOfferingCounter implements OfferingCounter {
  async increment(): Promise<number> {
    const document = await this.model()
      .findOneAndUpdate(
        {},
        { $inc: { count: 1 }, $setOnInsert: { offeringCounterId: newId() } },
        { upsert: true, returnDocument: "after", ...sessionOption(getActiveSession()) },
      )
      .lean<OfferingCounterDocument>();
    return document?.count ?? 1;
  }

  async decrement(): Promise<void> {
    await this.model().updateOne(
      { count: { $gt: 0 } },
      { $inc: { count: -1 } },
      sessionOption(getActiveSession()),
    );
  }

  private model() {
    return models({}).get<OfferingCounterDocument>(OFFERING_COUNTER_MODEL_NAME);
  }
}

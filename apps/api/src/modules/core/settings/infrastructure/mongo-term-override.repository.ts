import type { Model } from "mongoose";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import { conflict } from "../../../../kernel/http/index.js";
import { termVersionRequired } from "../domain/term-errors.js";
import type {
  NewTermOverride,
  StoredTermOverride,
  TermOverrideDelete,
  TermOverrideRepository,
  TermOverrideWrite,
} from "../application/ports/term-override-repository.js";
import { TERM_OVERRIDE_MODEL_NAME, type TermOverrideDocument } from "./term-override.schema.js";

type TermRow = Pick<TermOverrideDocument, "termKey" | "locale" | "text" | "version">;

const ROW_PROJECTION = { termKey: 1, locale: 1, text: 1, version: 1, _id: 0 } as const;

function termModel(): Model<TermOverrideDocument> {
  return models({}).get<TermOverrideDocument>(TERM_OVERRIDE_MODEL_NAME);
}

/** Organization-scoped term overrides. The tenant plugin supplies organizationId (ADR-104). */
export class MongoTermOverrideRepository implements TermOverrideRepository {
  async list(): Promise<readonly StoredTermOverride[]> {
    const rows = await termModel()
      .find({}, ROW_PROJECTION, sessionOption(getActiveSession()))
      .lean<TermRow[]>();
    return rows;
  }

  async insert(row: NewTermOverride): Promise<void> {
    try {
      await termModel().create(
        [
          {
            termOverrideId: row.termOverrideId,
            organizationId: row.organizationId,
            termKey: row.termKey,
            locale: row.locale,
            text: row.text,
            version: 1,
            createdByUserId: row.actorUserId,
            updatedByUserId: null,
          },
        ],
        sessionOption(getActiveSession()),
      );
    } catch (error) {
      if (isDuplicateKeyError(error, "termKey")) throw conflict({ currentVersion: 1 });
      throw error;
    }
  }

  async update(row: TermOverrideWrite): Promise<void> {
    await updateVersioned({
      model: termModel(),
      filter: { termKey: row.termKey, locale: row.locale },
      expectedVersion: row.version,
      update: { $set: { text: row.text, updatedByUserId: row.actorUserId } },
    });
  }

  async delete(row: TermOverrideDelete): Promise<void> {
    const result = await termModel().deleteOne(
      { termKey: row.termKey, locale: row.locale, version: row.version },
      sessionOption(getActiveSession()),
    );
    if (result.deletedCount === 1) return;
    const current = await termModel()
      .findOne({ termKey: row.termKey, locale: row.locale }, { version: 1, _id: 0 })
      .lean<{ version: number } | null>();
    throw termVersionRequired(current?.version ?? 1);
  }
}

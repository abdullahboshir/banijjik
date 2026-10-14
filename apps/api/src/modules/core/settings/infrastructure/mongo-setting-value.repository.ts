import type { Model } from "mongoose";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import { conflict, notFound } from "../../../../kernel/http/index.js";
import type {
  NewSettingValue,
  SettingValueDelete,
  SettingValueRepository,
  SettingValueWrite,
  StoredSettingRow,
} from "../application/ports/setting-value-repository.js";
import { SETTING_VALUE_MODEL_NAME, type SettingValueDocument } from "./setting-value.schema.js";

type SettingValueRow = Pick<
  SettingValueDocument,
  "settingKey" | "locationId" | "value" | "version"
>;

const ROW_PROJECTION = { settingKey: 1, locationId: 1, value: 1, version: 1, _id: 0 } as const;

function locationFilter(locationId: string | undefined): object {
  if (locationId === undefined) return { locationId: null };
  return { $or: [{ locationId: null }, { locationId }] };
}

function settingModel(): Model<SettingValueDocument> {
  return models({}).get<SettingValueDocument>(SETTING_VALUE_MODEL_NAME);
}

/** Setting rows are organization-scoped. `locationId` is data, not the location plugin (ADR-103). */
export class MongoSettingValueRepository implements SettingValueRepository {
  async findForResolution(
    settingKeys: readonly string[],
    locationId: string | undefined,
  ): Promise<readonly StoredSettingRow[]> {
    const rows = await settingModel()
      .find(
        { settingKey: { $in: settingKeys }, ...locationFilter(locationId) },
        ROW_PROJECTION,
        sessionOption(getActiveSession()),
      )
      .lean<SettingValueRow[]>();
    return rows.map(toStoredRow);
  }

  async findForWrite(
    settingKeys: readonly string[],
    locationIds: readonly string[],
  ): Promise<readonly StoredSettingRow[]> {
    const locationClauses: object[] = [{ locationId: null }];
    if (locationIds.length > 0) locationClauses.push({ locationId: { $in: locationIds } });
    const rows = await settingModel()
      .find(
        { settingKey: { $in: settingKeys }, $or: locationClauses },
        ROW_PROJECTION,
        sessionOption(getActiveSession()),
      )
      .lean<SettingValueRow[]>();
    return rows.map(toStoredRow);
  }

  async insert(row: NewSettingValue): Promise<void> {
    try {
      await settingModel().create([toInsert(row)], sessionOption(getActiveSession()));
    } catch (error) {
      if (isDuplicateKeyError(error, "settingKey")) throw conflict({ currentVersion: 1 });
      throw error;
    }
  }

  async update(row: SettingValueWrite): Promise<void> {
    await updateVersioned({
      model: settingModel(),
      filter: { settingKey: row.settingKey, locationId: row.locationId },
      expectedVersion: row.version,
      update: { $set: { value: row.value, updatedByUserId: row.actorUserId } },
    });
  }

  async delete(row: SettingValueDelete): Promise<void> {
    const result = await settingModel().deleteOne(
      { settingKey: row.settingKey, locationId: row.locationId, version: row.version },
      sessionOption(getActiveSession()),
    );
    if (result.deletedCount === 1) return;
    await throwDeleteConflict(row);
  }
}

function toStoredRow(row: SettingValueRow): StoredSettingRow {
  return { ...row, locationId: row.locationId ?? null };
}

function toInsert(row: NewSettingValue) {
  return {
    settingValueId: row.settingValueId,
    organizationId: row.organizationId,
    settingKey: row.settingKey,
    locationId: row.locationId,
    value: row.value,
    version: 1,
    createdByUserId: row.actorUserId,
    updatedByUserId: row.actorUserId,
  };
}

async function throwDeleteConflict(row: SettingValueDelete): Promise<never> {
  const current = await settingModel()
    .findOne(
      { settingKey: row.settingKey, locationId: row.locationId },
      { version: 1, _id: 0 },
      sessionOption(getActiveSession()),
    )
    .lean<{ version: number }>();
  if (current === null) throw notFound();
  throw conflict({ currentVersion: current.version });
}

import type { UserId } from "@banijjik/ids";

/** One stored row. `locationId` null is the organization-level value. */
export interface StoredSettingRow {
  readonly settingKey: string;
  readonly locationId: string | null;
  readonly value: unknown;
  readonly version: number;
}

export interface NewSettingValue {
  readonly settingValueId: string;
  readonly organizationId: string;
  readonly settingKey: string;
  readonly locationId: string | null;
  readonly value: unknown;
  readonly actorUserId: UserId;
}

export interface SettingValueWrite {
  readonly settingKey: string;
  readonly locationId: string | null;
  readonly version: number;
  readonly value: unknown;
  readonly actorUserId: UserId;
}

export interface SettingValueDelete {
  readonly settingKey: string;
  readonly locationId: string | null;
  readonly version: number;
}

/** One indexed read of the organization's rows for the requested keys (ADR-103). */
export interface SettingValueRepository {
  findForResolution(
    settingKeys: readonly string[],
    locationId: string | undefined,
  ): Promise<readonly StoredSettingRow[]>;
  /** Organization rows plus the location rows named in one batch, in one query. */
  findForWrite(
    settingKeys: readonly string[],
    locationIds: readonly string[],
  ): Promise<readonly StoredSettingRow[]>;
  insert(row: NewSettingValue): Promise<void>;
  update(row: SettingValueWrite): Promise<void>;
  delete(row: SettingValueDelete): Promise<void>;
}

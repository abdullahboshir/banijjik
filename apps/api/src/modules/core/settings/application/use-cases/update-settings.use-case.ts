import {
  ERROR_CODE,
  SETTINGS_EVENT_TYPE,
  DomainRuleError,
  type ModuleKey,
  type ResolvedSetting,
  type SettingChange,
} from "@banijjik/contracts";
import { newId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { OrgConfigReader } from "../../../../../kernel/access/index.js";
import type { ConfigVersionBumper } from "../../../../../kernel/tenancy/index.js";
import { settingVersionRequired } from "../../domain/setting-errors.js";
import { prepareSettingChange, type PreparedSettingChange } from "../prepare-setting-change.js";
import type { LocationExistence } from "../ports/location-existence.js";
import type { SettingsEventPublisher } from "../ports/settings-event-publisher.js";
import type {
  SettingValueRepository,
  StoredSettingRow,
} from "../ports/setting-value-repository.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";
import { recordSettingChange, type SettingAuditChange } from "../record-setting-change.js";
import type { RegisteredSetting } from "../setting-catalog.js";
import type { SettingsResolver } from "../settings-resolver.js";

export interface UpdateSettingsDependencies {
  readonly catalog: ReadonlyMap<string, RegisteredSetting>;
  readonly orgConfig: OrgConfigReader;
  readonly locations: LocationExistence;
  readonly values: SettingValueRepository;
  readonly resolver: SettingsResolver;
  readonly unitOfWork: UnitOfWork;
  readonly audit: AuditRecorder;
  readonly events: SettingsEventPublisher;
  readonly configVersion: ConfigVersionBumper;
}

export interface UpdateSettingsInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly reach: readonly string[] | "ALL";
  readonly items: readonly SettingChange[];
}

/**
 * One transaction. A batch that changes something writes one audit entry, one event and one
 * configVersion bump. A batch that changes nothing writes none of those (review R1-3).
 */
export class UpdateSettingsUseCase {
  constructor(private readonly dependencies: UpdateSettingsDependencies) {}

  async execute(input: UpdateSettingsInput): Promise<ReadonlyMap<string, ResolvedSetting>> {
    const effective = new Set((await this.dependencies.orgConfig.current()).modules);
    const prepared = await this.prepareAll(input, effective);
    await this.dependencies.unitOfWork.run(() => this.commit(input, prepared));
    return this.resolvedTouched(input.organizationId, prepared);
  }

  private async prepareAll(
    input: UpdateSettingsInput,
    effective: ReadonlySet<ModuleKey>,
  ): Promise<PreparedSettingChange[]> {
    const prepared: PreparedSettingChange[] = [];
    for (const [index, item] of input.items.entries()) {
      prepared.push(
        await prepareSettingChange({
          item,
          index,
          catalog: this.dependencies.catalog,
          effective,
          reach: input.reach,
          locations: this.dependencies.locations,
        }),
      );
    }
    return prepared;
  }

  private async commit(
    input: UpdateSettingsInput,
    prepared: readonly PreparedSettingChange[],
  ): Promise<void> {
    const rows = await this.loadRows(prepared);
    const applied: SettingAuditChange[] = [];
    for (const change of prepared) {
      const recorded = await this.apply(input, change, rows.get(rowMark(change)));
      if (recorded !== undefined) applied.push(recorded);
    }
    if (applied.length === 0) return;
    await recordSettingChange(this.dependencies.audit, input.organizationId, applied);
    await this.dependencies.events.publish(SETTINGS_EVENT_TYPE.SETTING_CHANGED, {
      settingKeys: uniqueKeys(applied.map((entry) => entry.change)),
    });
    await this.dependencies.configVersion.bump(input.organizationId);
  }

  private async apply(
    input: UpdateSettingsInput,
    change: PreparedSettingChange,
    row: StoredSettingRow | undefined,
  ): Promise<SettingAuditChange | undefined> {
    if (change.value === null) return this.remove(change, row);
    if (row === undefined) return this.create(input, change);
    requireVersion(change, row);
    if (valuesEqual(row.value, change.value)) return undefined;
    await this.dependencies.values.update({
      settingKey: change.settingKey,
      locationId: change.locationId,
      version: change.version ?? row.version,
      value: change.value,
      actorUserId: input.actorUserId,
    });
    return { change, from: row.value, to: change.value };
  }

  private async remove(
    change: PreparedSettingChange,
    row: StoredSettingRow | undefined,
  ): Promise<SettingAuditChange | undefined> {
    if (row === undefined) return undefined;
    requireVersion(change, row);
    await this.dependencies.values.delete({
      settingKey: change.settingKey,
      locationId: change.locationId,
      version: change.version ?? row.version,
    });
    return { change, from: row.value, to: null };
  }

  private async create(
    input: UpdateSettingsInput,
    change: PreparedSettingChange,
  ): Promise<SettingAuditChange> {
    if (change.version !== undefined) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
    await this.dependencies.values.insert({
      settingValueId: newId(),
      organizationId: input.organizationId,
      settingKey: change.settingKey,
      locationId: change.locationId,
      value: change.value,
      actorUserId: input.actorUserId,
    });
    return { change, from: null, to: change.value };
  }

  private async loadRows(
    prepared: readonly PreparedSettingChange[],
  ): Promise<Map<string, StoredSettingRow>> {
    const locationIds = prepared.flatMap((change) =>
      change.locationId === null ? [] : [change.locationId],
    );
    const rows = await this.dependencies.values.findForWrite(
      prepared.map((change) => change.settingKey),
      locationIds,
    );
    return new Map(rows.map((row) => [rowMark(row), row]));
  }

  private async resolvedTouched(
    organizationId: OrganizationId,
    prepared: readonly PreparedSettingChange[],
  ): Promise<Map<string, ResolvedSetting>> {
    const merged = new Map<string, ResolvedSetting>();
    for (const [locationId, keys] of keysByLocation(prepared)) {
      const resolved = await this.dependencies.resolver.resolve(organizationId, {
        keys,
        ...(locationId === null ? {} : { locationId }),
      });
      for (const [settingKey, value] of resolved) merged.set(settingKey, value);
    }
    return new Map(
      [...merged.entries()].sort(([left], [right]) => left.localeCompare(right, "en")),
    );
  }
}

function valuesEqual(stored: unknown, next: unknown): boolean {
  return JSON.stringify(stored) === JSON.stringify(next);
}

function requireVersion(change: PreparedSettingChange, row: StoredSettingRow): void {
  if (change.version === undefined) throw settingVersionRequired(row.version);
  if (change.version !== row.version) throw settingVersionRequired(row.version);
}

function rowMark(row: { settingKey: string; locationId: string | null }): string {
  return `${row.settingKey}\u0000${row.locationId ?? ""}`;
}

function uniqueKeys(prepared: readonly PreparedSettingChange[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const change of prepared) {
    if (seen.has(change.settingKey)) continue;
    seen.add(change.settingKey);
    keys.push(change.settingKey);
  }
  return keys;
}

function keysByLocation(prepared: readonly PreparedSettingChange[]): Map<string | null, string[]> {
  const grouped = new Map<string | null, string[]>();
  for (const change of prepared) {
    const keys = grouped.get(change.locationId) ?? [];
    keys.push(change.settingKey);
    grouped.set(change.locationId, keys);
  }
  return grouped;
}

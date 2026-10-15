import type { ModuleKey, ResolvedSetting } from "@banijjik/contracts";
import type { OrgConfigReader } from "../../../../kernel/access/index.js";
import type { IndustrySettingDefaultsReader } from "./ports/industry-setting-defaults-reader.js";
import type { SettingValueRepository, StoredSettingRow } from "./ports/setting-value-repository.js";
import { resolveSetting } from "./resolve-setting.js";
import type { RegisteredSetting } from "./setting-catalog.js";

export interface SettingsResolveQuery {
  readonly locationId?: string;
  readonly keys?: readonly string[];
}

export interface SettingsResolverDependencies {
  readonly catalog: ReadonlyMap<string, RegisteredSetting>;
  readonly orgConfig: OrgConfigReader;
  readonly values: SettingValueRepository;
  readonly defaults: IndustrySettingDefaultsReader;
}

function rowMark(settingKey: string, locationId: string | null): string {
  return `${settingKey}\u0000${locationId ?? ""}`;
}

function selectedSettings(
  catalog: ReadonlyMap<string, RegisteredSetting>,
  effective: ReadonlySet<ModuleKey>,
  keys: readonly string[] | undefined,
): RegisteredSetting[] {
  const wanted = keys === undefined ? undefined : new Set(keys);
  return [...catalog.values()]
    .filter(
      (setting) =>
        effective.has(setting.moduleKey) &&
        (wanted === undefined || wanted.has(setting.settingKey)),
    )
    .sort((left, right) => left.settingKey.localeCompare(right.settingKey, "en"));
}

function indexRows(rows: readonly StoredSettingRow[]): Map<string, StoredSettingRow> {
  return new Map(rows.map((row) => [rowMark(row.settingKey, row.locationId), row]));
}

/**
 * Resolves each effective setting in ADR-016 order. Two indexed reads: the organization's rows
 * and the template defaults. Caching per configVersion belongs to card 2.2.
 */
export class SettingsResolver {
  constructor(private readonly dependencies: SettingsResolverDependencies) {}

  async resolve(
    organizationId: string,
    query: SettingsResolveQuery,
  ): Promise<ReadonlyMap<string, ResolvedSetting>> {
    const effective = new Set((await this.dependencies.orgConfig.current()).modules);
    const definitions = selectedSettings(this.dependencies.catalog, effective, query.keys);
    return this.resolveDefinitions(organizationId, definitions, query.locationId);
  }

  /**
   * Organization-level values of client-visible settings. The caller passes the effective module
   * set, so this path never asks OrgConfigReader (ADR-104).
   */
  async resolveClientVisible(
    organizationId: string,
    effectiveModules: ReadonlySet<ModuleKey>,
  ): Promise<Record<string, unknown>> {
    const definitions = selectedSettings(
      this.dependencies.catalog,
      effectiveModules,
      undefined,
    ).filter((definition) => definition.isClientVisible);
    const resolved = await this.resolveDefinitions(organizationId, definitions, undefined);
    return Object.fromEntries(
      [...resolved].map(([settingKey, value]) => [settingKey, value.value]),
    );
  }

  private async resolveDefinitions(
    organizationId: string,
    definitions: readonly RegisteredSetting[],
    locationId: string | undefined,
  ): Promise<ReadonlyMap<string, ResolvedSetting>> {
    const { values, defaults } = this.dependencies;
    if (definitions.length === 0) return new Map();
    const settingKeys = definitions.map((definition) => definition.settingKey);
    const [rows, template] = await Promise.all([
      values.findForResolution(settingKeys, locationId),
      defaults.read(organizationId),
    ]);
    return assemble({ definitions, rows: indexRows(rows), template, locationId });
  }
}

interface AssembleInput {
  readonly definitions: readonly RegisteredSetting[];
  readonly rows: ReadonlyMap<string, StoredSettingRow>;
  readonly template:
    { templateVersion: number; settingsDefaults: Readonly<Record<string, unknown>> } | undefined;
  readonly locationId: string | undefined;
}

function assemble(input: AssembleInput): Map<string, ResolvedSetting> {
  const { definitions, rows, template, locationId } = input;
  const resolved = new Map<string, ResolvedSetting>();
  for (const definition of definitions) {
    resolved.set(
      definition.settingKey,
      resolveSetting({
        definition,
        locationRow:
          locationId === undefined
            ? undefined
            : rows.get(rowMark(definition.settingKey, locationId)),
        organizationRow: rows.get(rowMark(definition.settingKey, null)),
        templateDefault: template?.settingsDefaults[definition.settingKey],
        templateVersion: template?.templateVersion,
        locationRequested: locationId !== undefined,
      }),
    );
  }
  return resolved;
}

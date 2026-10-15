import {
  isCustomFieldEntityType,
  type CustomFieldEntityType,
  type EffectiveCustomField,
  type ModuleKey,
} from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";
import type { ModuleRegistry } from "../../../../kernel/modules/index.js";
import { buildIndustryCustomFieldReader } from "../../../platform/industry/index.js";
import { EffectiveCustomFieldReaderService } from "../application/effective-custom-field-reader.js";
import { MongoCustomFieldDefinitionRepository } from "./mongo-custom-field-definition.repository.js";
import { MongoCustomFieldPreferenceRepository } from "./mongo-custom-field-preference.repository.js";

function declaredEntityTypes(
  registry: ModuleRegistry,
  effectiveModules: ReadonlySet<ModuleKey>,
): CustomFieldEntityType[] {
  const names = new Set<CustomFieldEntityType>();
  for (const manifest of registry.all()) {
    if (!effectiveModules.has(manifest.key)) continue;
    for (const entityType of manifest.customFieldEntities) {
      if (isCustomFieldEntityType(entityType)) names.add(entityType);
    }
  }
  return [...names].sort();
}

/**
 * Effective fields for the module set the resolver passes in. It does not ask which modules are
 * on (ADR-104). Unknown probe entity names are ignored; the engine only knows the catalogue.
 */
export function buildModuleFieldsReader(registry: ModuleRegistry): {
  forModules(
    organizationId: string,
    effectiveModules: ReadonlySet<ModuleKey>,
  ): Promise<Record<string, readonly EffectiveCustomField[]>>;
} {
  const reader = new EffectiveCustomFieldReaderService({
    definitions: new MongoCustomFieldDefinitionRepository(),
    preferences: new MongoCustomFieldPreferenceRepository(),
    industry: buildIndustryCustomFieldReader(),
  });
  return {
    async forModules(organizationId, effectiveModules) {
      const fields: Record<string, readonly EffectiveCustomField[]> = {};
      for (const entityType of declaredEntityTypes(registry, effectiveModules)) {
        fields[entityType] = await reader.forEntity(organizationId as OrganizationId, entityType);
      }
      return fields;
    },
  };
}

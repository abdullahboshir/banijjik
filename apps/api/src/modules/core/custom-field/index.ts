import type { ModuleManifest } from "@banijjik/contracts";
import type { PermissionMiddlewareFactory, OrgConfigReader } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { ModuleRegistry } from "../../../kernel/modules/index.js";
import type { ConfigVersionBumper } from "../../../kernel/tenancy/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import { buildIndustryCustomFieldReader } from "../../platform/industry/index.js";
import { EffectiveCustomFieldReaderService } from "./application/effective-custom-field-reader.js";
import type { EffectiveCustomFieldReader } from "./application/ports/custom-field-ports.js";
import type { CustomFieldWriteDependencies } from "./application/ports/custom-field-write-dependencies.js";
import { ArchiveCustomFieldDefinitionUseCase } from "./application/use-cases/archive-custom-field-definition.use-case.js";
import { CreateCustomFieldDefinitionUseCase } from "./application/use-cases/create-custom-field-definition.use-case.js";
import { ListCustomFieldsUseCase } from "./application/use-cases/list-custom-fields.use-case.js";
import { UpdateCustomFieldDefinitionUseCase } from "./application/use-cases/update-custom-field-definition.use-case.js";
import { UpdateCustomFieldPreferencesUseCase } from "./application/use-cases/update-custom-field-preferences.use-case.js";
import { assertKnownCustomFieldEntities } from "./domain/declared-entities.js";
import { MongoCustomFieldDefinitionRepository } from "./infrastructure/mongo-custom-field-definition.repository.js";
import { MongoCustomFieldPreferenceRepository } from "./infrastructure/mongo-custom-field-preference.repository.js";
import { RegistryCustomFieldAvailability } from "./infrastructure/registry-custom-field-availability.js";
import { CustomFieldController } from "./presentation/custom-field.controller.js";
import { buildCustomFieldRouter } from "./presentation/custom-field.router.js";

export { customFieldManifest } from "./module.manifest.js";
export { registerCustomFieldModels } from "./infrastructure/register-custom-field-models.js";
export type { EffectiveCustomFieldReader } from "./application/ports/custom-field-ports.js";
export { buildModuleFieldsReader } from "./infrastructure/module-fields.js";

/** Phase 3 modules import this through the index and call `forEntity` (ADR-102). */
export function buildEffectiveCustomFieldReader(): EffectiveCustomFieldReader {
  return new EffectiveCustomFieldReaderService({
    definitions: new MongoCustomFieldDefinitionRepository(),
    preferences: new MongoCustomFieldPreferenceRepository(),
    industry: buildIndustryCustomFieldReader(),
  });
}

export interface CustomFieldRouterDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly orgConfig: OrgConfigReader;
  readonly registry: ModuleRegistry;
  readonly configVersion: ConfigVersionBumper;
  /** Production manifests only. Test probes are not checked here (they name entities the product does not ship). */
  readonly productionManifests: readonly Pick<ModuleManifest, "key" | "customFieldEntities">[];
}

/** The tenant router, and the reader Phase 3 modules import through this index. */
export function buildCustomFieldModule(dependencies: CustomFieldRouterDependencies): {
  readonly router: ReturnType<typeof buildCustomFieldRouter>;
  readonly reader: EffectiveCustomFieldReader;
} {
  assertKnownCustomFieldEntities(dependencies.productionManifests);
  const definitions = new MongoCustomFieldDefinitionRepository();
  const preferences = new MongoCustomFieldPreferenceRepository();
  const industry = buildIndustryCustomFieldReader();
  const reader = new EffectiveCustomFieldReaderService({ definitions, preferences, industry });
  const writes = writeDependencies({ dependencies, definitions, preferences, industry });
  const controller = new CustomFieldController({
    listFields: new ListCustomFieldsUseCase(
      new RegistryCustomFieldAvailability(dependencies.orgConfig, dependencies.registry),
      reader,
    ),
    createField: new CreateCustomFieldDefinitionUseCase(writes),
    updateField: new UpdateCustomFieldDefinitionUseCase(writes),
    archiveField: new ArchiveCustomFieldDefinitionUseCase(writes),
    updatePreferences: new UpdateCustomFieldPreferencesUseCase(writes),
  });
  return { router: buildCustomFieldRouter(controller, dependencies.permission), reader };
}

function writeDependencies(input: {
  readonly dependencies: CustomFieldRouterDependencies;
  readonly definitions: MongoCustomFieldDefinitionRepository;
  readonly preferences: MongoCustomFieldPreferenceRepository;
  readonly industry: ReturnType<typeof buildIndustryCustomFieldReader>;
}): CustomFieldWriteDependencies {
  const { dependencies, definitions, preferences, industry } = input;
  return {
    definitions,
    preferences,
    industry,
    availability: new RegistryCustomFieldAvailability(
      dependencies.orgConfig,
      dependencies.registry,
    ),
    unitOfWork: new MongoUnitOfWork(),
    audit: dependencies.audit,
    events: kernelEventPublisher,
    configVersion: dependencies.configVersion,
    clock: dependencies.clock,
  };
}

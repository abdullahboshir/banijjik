import type { CustomFieldEntityType, ModuleKey } from "@banijjik/contracts";
import type { OrgConfigReader } from "../../../../kernel/access/index.js";
import type { ModuleRegistry } from "../../../../kernel/modules/index.js";
import type { CustomFieldAvailability } from "../application/ports/custom-field-ports.js";

/**
 * An entity is offered when an effective module of this organization declares it.
 * The registry includes test probes; production manifests are checked separately at startup.
 */
export class RegistryCustomFieldAvailability implements CustomFieldAvailability {
  constructor(
    private readonly orgConfig: OrgConfigReader,
    private readonly registry: ModuleRegistry,
  ) {}

  async isOffered(entityType: CustomFieldEntityType): Promise<boolean> {
    const config = await this.orgConfig.current();
    const effective = new Set<ModuleKey>(config.modules);
    return this.registry.all().some((manifest) => {
      return effective.has(manifest.key) && manifest.customFieldEntities.includes(entityType);
    });
  }
}

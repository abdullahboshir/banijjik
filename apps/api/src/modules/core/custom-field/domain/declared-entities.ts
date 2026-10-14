import { isCustomFieldEntityType } from "@banijjik/contracts";

interface DeclaredEntities {
  readonly key: string;
  readonly customFieldEntities: readonly string[];
}

/**
 * Refuses to start when a manifest names an entity the engine does not know.
 * Manifests still store the names as plain strings (module-manifest.ts belongs to card 2.4).
 */
export function assertKnownCustomFieldEntities(manifests: readonly DeclaredEntities[]): void {
  for (const manifest of manifests) {
    for (const entityType of manifest.customFieldEntities) {
      if (!isCustomFieldEntityType(entityType)) {
        throw new Error(
          `Module ${manifest.key} declares custom field entity "${entityType}", which is not a CUSTOM_FIELD_ENTITY_TYPE.`,
        );
      }
    }
  }
}

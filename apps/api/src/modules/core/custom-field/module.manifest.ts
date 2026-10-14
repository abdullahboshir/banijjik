import {
  CUSTOM_FIELD_EVENT_TYPE,
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  permissionDefinition,
} from "@banijjik/contracts";
import { defineModule } from "../../../kernel/modules/index.js";

/** The custom field engine (10-MODULE-CATALOG). It declares no entities of its own. */
export const customFieldManifest = defineModule({
  key: MODULE_KEY.CUSTOM_FIELD,
  path: "core/custom-field",
  moduleClass: MODULE_CLASS.SYSTEM,
  dependsOn: [],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [
    permissionDefinition(PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_READ),
    permissionDefinition(PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_CREATE),
    permissionDefinition(PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_UPDATE),
    permissionDefinition(PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_ARCHIVE),
  ],
  routes: { admin: ["/orgs/:organizationId/custom-fields"] },
  menu: [],
  settingKeys: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: { emits: [CUSTOM_FIELD_EVENT_TYPE.DEFINITION_CHANGED], consumes: [] },
  limitKeys: [],
  sequenceKeys: [],
});

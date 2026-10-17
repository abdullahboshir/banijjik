import {
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  permissionDefinition,
} from "@banijjik/contracts";
import { defineModule } from "../../../kernel/modules/index.js";

/** Uploaded files and images (10-MODULE-CATALOG, ADR-109). It has no screen of its own. */
export const fileManifest = defineModule({
  key: MODULE_KEY.FILE,
  path: "core/file",
  moduleClass: MODULE_CLASS.SYSTEM,
  dependsOn: [],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [
    permissionDefinition(PERMISSION_KEY.FILE_ASSET_READ),
    permissionDefinition(PERMISSION_KEY.FILE_ASSET_CREATE),
    permissionDefinition(PERMISSION_KEY.FILE_ASSET_DELETE),
  ],
  routes: { admin: ["/orgs/:organizationId/files"] },
  menu: [],
  settings: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: { emits: [], consumes: [] },
  limitKeys: [],
  sequenceKeys: [],
});

import {
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  SETTINGS_TOPIC,
  SURFACE,
  permissionDefinition,
} from "@banijjik/contracts";
import { WEBSITE_EVENT_TYPE } from "@banijjik/contracts/website";
import { defineModule } from "../../../kernel/modules/index.js";

/**
 * The website manifest (ADR-144, M.6a). Static pages are its first page kind; the menu and the
 * admin editor come with M.6c. The site read is not gated by this module: it answers for every
 * business and reports `features.website` instead.
 */
export const websiteManifest = defineModule({
  key: MODULE_KEY.WEBSITE,
  path: "commerce/website",
  moduleClass: MODULE_CLASS.OPTIONAL,
  dependsOn: [],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: true,
  permissions: [
    permissionDefinition(PERMISSION_KEY.WEBSITE_PAGE_READ),
    permissionDefinition(PERMISSION_KEY.WEBSITE_PAGE_UPDATE),
  ],
  routes: {
    admin: ["/orgs/:organizationId/website"],
    storefront: ["/storefront/orgs/:organizationId/pages"],
  },
  menu: [
    {
      menuKey: "website.pages",
      surface: SURFACE.ADMIN,
      groupKey: "settings",
      labelTermKey: "menu.website.pages",
      path: "website/pages",
      iconKey: "globe",
      permissionKey: PERMISSION_KEY.WEBSITE_PAGE_READ,
      order: 60,
      settingsTopicKey: SETTINGS_TOPIC.WEBSITE,
    },
  ],
  settings: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: {
    emits: [WEBSITE_EVENT_TYPE.PAGE_UPDATED],
    consumes: [],
  },
  limitKeys: [],
  sequenceKeys: [],
});

import {
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  SETTINGS_TOPIC,
  SURFACE,
  permissionDefinition,
} from "@banijjik/contracts";
import {
  SECTION_KEY,
  WEBSITE_CHECKOUT_ENABLED_SETTING_KEY,
  WEBSITE_EVENT_TYPE,
  WEBSITE_GUEST_CHECKOUT_SETTING_KEY,
  WEBSITE_PUBLIC_LOCATION_IDS_SETTING_KEY,
} from "@banijjik/contracts/website";
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
    permissionDefinition(PERMISSION_KEY.WEBSITE_SITE_READ),
    permissionDefinition(PERMISSION_KEY.WEBSITE_SITE_UPDATE),
    permissionDefinition(PERMISSION_KEY.WEBSITE_SITE_PUBLISH),
    permissionDefinition(PERMISSION_KEY.WEBSITE_DOMAIN_MANAGE),
  ],
  routes: {
    admin: ["/orgs/:organizationId/website"],
    storefront: [
      "/storefront/orgs/:organizationId/pages",
      "/storefront/orgs/:organizationId/published-site",
    ],
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
    {
      menuKey: "website.domains",
      surface: SURFACE.ADMIN,
      groupKey: "settings",
      labelTermKey: "menu.website.domains",
      path: "website/domains",
      iconKey: "globe",
      permissionKey: PERMISSION_KEY.WEBSITE_DOMAIN_MANAGE,
      order: 61,
      settingsTopicKey: SETTINGS_TOPIC.WEBSITE,
    },
  ],
  settings: [
    {
      settingKey: WEBSITE_GUEST_CHECKOUT_SETTING_KEY,
      value: { kind: "BOOLEAN" },
      systemDefault: true,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
    {
      settingKey: WEBSITE_CHECKOUT_ENABLED_SETTING_KEY,
      value: { kind: "BOOLEAN" },
      systemDefault: false,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
    {
      settingKey: WEBSITE_PUBLIC_LOCATION_IDS_SETTING_KEY,
      value: { kind: "STRUCTURED", schemaKey: "website.publicLocationIds" },
      systemDefault: [],
      allowsLocationOverride: false,
      isClientVisible: true,
    },
  ],
  customFieldEntities: [],
  botTools: [],
  /** The chrome and the static blocks the website module itself renders (decision 10). */
  storefrontSections: [
    SECTION_KEY.header,
    SECTION_KEY.hero,
    SECTION_KEY["rich-text"],
    SECTION_KEY.faq,
    SECTION_KEY.testimonials,
    SECTION_KEY.contact,
    SECTION_KEY.footer,
  ],
  events: {
    emits: [
      WEBSITE_EVENT_TYPE.PAGE_UPDATED,
      WEBSITE_EVENT_TYPE.SITE_PUBLISHED,
      WEBSITE_EVENT_TYPE.SITE_UNPUBLISHED,
      WEBSITE_EVENT_TYPE.DOMAIN_REQUESTED,
      WEBSITE_EVENT_TYPE.DOMAIN_VERIFICATION_REQUESTED,
      WEBSITE_EVENT_TYPE.DOMAIN_REMOVAL_REQUESTED,
      WEBSITE_EVENT_TYPE.DOMAIN_STATE_CHANGED,
      WEBSITE_EVENT_TYPE.GUEST_SESSION_CREATED,
      WEBSITE_EVENT_TYPE.CHECKOUT_CREATED,
    ],
    consumes: [],
  },
  limitKeys: [],
  sequenceKeys: [],
});

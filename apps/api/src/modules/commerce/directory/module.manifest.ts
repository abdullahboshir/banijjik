import {
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  SEQUENCE_KEY,
  SURFACE,
  permissionDefinition,
} from "@banijjik/contracts";
import {
  DIRECTORY_EVENT_TYPE,
  DIRECTORY_ONE_LISTING_SETTING_KEY,
  DIRECTORY_PHOTO_POLICY,
  DIRECTORY_PHOTO_POLICY_SETTING_KEY,
  DIRECTORY_REVIEW_EDITS_SETTING_KEY,
} from "@banijjik/contracts/directory";
import { defineModule } from "../../../kernel/modules/index.js";

/** The directory manifest (doc 16 §3.1, ADR-127). */
export const directoryManifest = defineModule({
  key: MODULE_KEY.DIRECTORY,
  path: "commerce/directory",
  moduleClass: MODULE_CLASS.OPTIONAL,
  dependsOn: [],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [
    permissionDefinition(PERMISSION_KEY.DIRECTORY_LISTING_READ),
    permissionDefinition(PERMISSION_KEY.DIRECTORY_LISTING_REVIEW),
    permissionDefinition(PERMISSION_KEY.DIRECTORY_LISTING_HIDE),
  ],
  routes: {
    admin: ["/orgs/:organizationId/directory"],
    storefront: [
      "/storefront/orgs/:organizationId/listings",
      "/storefront/orgs/:organizationId/my/listing",
    ],
  },
  menu: [
    {
      menuKey: "directory.queue",
      surface: SURFACE.ADMIN,
      groupKey: "directory",
      labelTermKey: "menu.directory.queue",
      termKey: "listing",
      path: "directory/queue",
      iconKey: "clipboard-list",
      permissionKey: PERMISSION_KEY.DIRECTORY_LISTING_REVIEW,
      order: 10,
    },
    {
      menuKey: "directory.listings",
      surface: SURFACE.ADMIN,
      groupKey: "directory",
      labelTermKey: "menu.directory.listings",
      termKey: "listing",
      path: "directory/listings",
      iconKey: "list",
      permissionKey: PERMISSION_KEY.DIRECTORY_LISTING_READ,
      order: 20,
    },
  ],
  settings: [
    {
      settingKey: DIRECTORY_ONE_LISTING_SETTING_KEY,
      value: { kind: "BOOLEAN" },
      systemDefault: true,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
    {
      settingKey: DIRECTORY_REVIEW_EDITS_SETTING_KEY,
      value: { kind: "BOOLEAN" },
      systemDefault: true,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
    {
      settingKey: DIRECTORY_PHOTO_POLICY_SETTING_KEY,
      value: { kind: "ENUM", values: Object.values(DIRECTORY_PHOTO_POLICY) },
      systemDefault: DIRECTORY_PHOTO_POLICY.NONE,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
  ],
  customFieldEntities: ["listing"],
  botTools: [],
  storefrontSections: [],
  events: {
    emits: [
      DIRECTORY_EVENT_TYPE.LISTING_SUBMITTED,
      DIRECTORY_EVENT_TYPE.LISTING_APPROVED,
      DIRECTORY_EVENT_TYPE.LISTING_REJECTED,
      DIRECTORY_EVENT_TYPE.LISTING_HIDDEN,
      DIRECTORY_EVENT_TYPE.LISTING_UNHIDDEN,
      DIRECTORY_EVENT_TYPE.LISTING_ARCHIVED,
      DIRECTORY_EVENT_TYPE.LISTING_UPDATED,
    ],
    consumes: [],
  },
  limitKeys: [],
  sequenceKeys: [SEQUENCE_KEY.LISTING],
});

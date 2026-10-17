import { defineEnum } from "../define-enum.js";

/**
 * When a menu entry shows besides its permission and kind rules (10-MODULE-CATALOG section 6).
 * The server decides, so the admin app never counts locations itself.
 */
export const MENU_VISIBILITY = defineEnum(["ALWAYS", "MULTIPLE_ACTIVE_LOCATIONS"]);

export type MenuVisibility = (typeof MENU_VISIBILITY)[keyof typeof MENU_VISIBILITY];

/**
 * The topics of the settings home, in the order they are shown (ADR-112). A settings menu entry names
 * its topic; a topic with no entry is hidden, so a module that adds a page only has to name one.
 * It lives here, beside the other menu-entry options, to keep the contracts index within its size limit.
 */
export const SETTINGS_TOPIC = defineEnum([
  "BUSINESS",
  "TEAM",
  "WEBSITE",
  "SALES",
  "PAYMENTS",
  "AUTOMATION",
  "ADVANCED",
]);

export type SettingsTopic = (typeof SETTINGS_TOPIC)[keyof typeof SETTINGS_TOPIC];

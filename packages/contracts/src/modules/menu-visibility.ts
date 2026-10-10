import { defineEnum } from "../define-enum.js";

/**
 * When a menu entry shows besides its permission and kind rules (10-MODULE-CATALOG section 6).
 * The server decides, so the admin app never counts locations itself.
 */
export const MENU_VISIBILITY = defineEnum(["ALWAYS", "MULTIPLE_ACTIVE_LOCATIONS"]);

export type MenuVisibility = (typeof MENU_VISIBILITY)[keyof typeof MENU_VISIBILITY];

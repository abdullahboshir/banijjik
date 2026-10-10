import { defineEnum } from "../define-enum.js";

/** The client surface a permission or menu entry belongs to (10-MODULE-CATALOG section 2). */
export const SURFACE = defineEnum(["ADMIN", "POS", "RIDER", "PLATFORM", "STOREFRONT"]);

export type Surface = (typeof SURFACE)[keyof typeof SURFACE];

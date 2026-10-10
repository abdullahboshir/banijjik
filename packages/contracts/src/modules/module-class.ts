import { defineEnum } from "../define-enum.js";

/** How the resolver treats a module (10-MODULE-CATALOG section 1). */
export const MODULE_CLASS = defineEnum(["PLATFORM", "SYSTEM", "CORE", "OPTIONAL"]);

export type ModuleClass = (typeof MODULE_CLASS)[keyof typeof MODULE_CLASS];

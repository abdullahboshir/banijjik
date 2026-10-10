import { defineEnum } from "../define-enum.js";

/** Roles of a platform operator (09 section 4.1). Platform-panel access is a PlatformOperator record, not a User flag. */
export const PLATFORM_ROLE = defineEnum(["SUPER_ADMIN", "SUPPORT", "BILLING"]);

export type PlatformRole = (typeof PLATFORM_ROLE)[keyof typeof PLATFORM_ROLE];

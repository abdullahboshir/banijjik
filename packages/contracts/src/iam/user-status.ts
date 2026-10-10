import { defineEnum } from "../define-enum.js";

/** Whether an account may log in (09 section 4.1). LOCKED is temporary, DISABLED is a platform decision. */
export const USER_STATUS = defineEnum(["ACTIVE", "LOCKED", "DISABLED"]);

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

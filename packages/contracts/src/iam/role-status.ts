import { defineEnum } from "../define-enum.js";

/** A role is archived instead of deleted, so history that references it stays readable (14-API.md section 2). */
export const ROLE_STATUS = defineEnum(["ACTIVE", "ARCHIVED"]);

export type RoleStatus = (typeof ROLE_STATUS)[keyof typeof ROLE_STATUS];

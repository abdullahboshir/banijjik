import { defineEnum } from "../define-enum.js";

export const PACKAGE_STATUS = defineEnum(["ACTIVE", "ARCHIVED"]);

export type PackageStatus = (typeof PACKAGE_STATUS)[keyof typeof PACKAGE_STATUS];

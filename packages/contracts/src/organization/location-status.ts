import { defineEnum } from "../define-enum.js";

export const LOCATION_STATUS = defineEnum(["ACTIVE", "ARCHIVED"]);

export type LocationStatus = (typeof LOCATION_STATUS)[keyof typeof LOCATION_STATUS];

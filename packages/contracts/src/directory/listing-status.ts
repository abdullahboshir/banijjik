import { defineEnum } from "../define-enum.js";

/** Lifecycle of a directory listing (doc 16 §3.1, ADR-127). */
export const LISTING_STATUS = defineEnum([
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "HIDDEN",
  "ARCHIVED",
]);

export type ListingStatus = (typeof LISTING_STATUS)[keyof typeof LISTING_STATUS];

import { defineEnum } from "../define-enum.js";

/**
 * Who may see a listing custom-field value (doc 16 §3.1, ADR-127).
 * Default for directory fields is PUBLIC.
 */
export const LISTING_FIELD_TIER = defineEnum(["PUBLIC", "MEMBERS", "UNLOCKED", "PRIVATE"]);

export type ListingFieldTier = (typeof LISTING_FIELD_TIER)[keyof typeof LISTING_FIELD_TIER];

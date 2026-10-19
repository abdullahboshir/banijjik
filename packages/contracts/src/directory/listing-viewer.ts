import { defineEnum } from "../define-enum.js";

/**
 * The caller of `projectListing` (ADR-127). Every endpoint picks one; controllers never filter fields.
 * UNLOCKED_MEMBER is reserved for M.4; until then customers never receive that viewer.
 */
export const LISTING_VIEWER = defineEnum(["PUBLIC", "MEMBER", "UNLOCKED_MEMBER", "OWNER", "STAFF"]);

export type ListingViewer = (typeof LISTING_VIEWER)[keyof typeof LISTING_VIEWER];

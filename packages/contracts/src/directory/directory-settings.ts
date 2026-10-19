import { defineEnum } from "../define-enum.js";

export const DIRECTORY_PHOTO_POLICY = defineEnum(["NONE", "BLURRED_PUBLIC", "UNLOCKED_ONLY"]);

export type DirectoryPhotoPolicy =
  (typeof DIRECTORY_PHOTO_POLICY)[keyof typeof DIRECTORY_PHOTO_POLICY];

export const DIRECTORY_ONE_LISTING_SETTING_KEY = "directory.oneListingPerAccount";
export const DIRECTORY_REVIEW_EDITS_SETTING_KEY = "directory.reviewEdits";
export const DIRECTORY_PHOTO_POLICY_SETTING_KEY = "directory.photoPolicy";

/** Scraping limits on public listing search (ADR-127). */
export const DIRECTORY_SEARCH_RULES = {
  perIp: { limit: 60, windowSeconds: 60 },
  perAccount: { limit: 120, windowSeconds: 60 },
  maxPageLimit: 50,
} as const;

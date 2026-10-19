/** Events of the directory module (`<module>.<entity>.<pastTenseVerb>`, ADR-127). */
export const DIRECTORY_EVENT_TYPE = Object.freeze({
  LISTING_SUBMITTED: "directory.listing.submitted",
  LISTING_APPROVED: "directory.listing.approved",
  LISTING_REJECTED: "directory.listing.rejected",
  /** Staff hide (event name must end in -ed / -d for the shared EVENT_NAME_PATTERN). */
  LISTING_HIDDEN: "directory.listing.concealed",
  LISTING_UNHIDDEN: "directory.listing.revealed",
  LISTING_ARCHIVED: "directory.listing.archived",
  LISTING_UPDATED: "directory.listing.updated",
} as const);

export type DirectoryEventType = (typeof DIRECTORY_EVENT_TYPE)[keyof typeof DIRECTORY_EVENT_TYPE];

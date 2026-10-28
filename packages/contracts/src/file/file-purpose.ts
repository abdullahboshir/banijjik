import { defineEnum } from "../define-enum.js";

/** Why a file is uploaded. The purpose decides who may see it (see FILE_VISIBILITY_BY_PURPOSE). */
export const FILE_PURPOSE = defineEnum([
  "LOGO",
  "OFFERING_IMAGE",
  "WEBSITE_IMAGE",
  "CUSTOM_FIELD_IMAGE",
  "CUSTOM_FIELD_FILE",
  "ATTACHMENT",
  "LISTING_PHOTO",
]);

export type FilePurpose = (typeof FILE_PURPOSE)[keyof typeof FILE_PURPOSE];

export const FILE_VISIBILITY = defineEnum(["PUBLIC", "PRIVATE"]);

export type FileVisibility = (typeof FILE_VISIBILITY)[keyof typeof FILE_VISIBILITY];

/** Visibility is derived from the purpose and never read from a request (ADR-109). */
export const FILE_VISIBILITY_BY_PURPOSE: Readonly<Record<FilePurpose, FileVisibility>> =
  Object.freeze({
    LOGO: FILE_VISIBILITY.PUBLIC,
    OFFERING_IMAGE: FILE_VISIBILITY.PUBLIC,
    WEBSITE_IMAGE: FILE_VISIBILITY.PUBLIC,
    CUSTOM_FIELD_IMAGE: FILE_VISIBILITY.PRIVATE,
    CUSTOM_FIELD_FILE: FILE_VISIBILITY.PRIVATE,
    ATTACHMENT: FILE_VISIBILITY.PRIVATE,
    LISTING_PHOTO: FILE_VISIBILITY.PRIVATE,
  });

export const FILE_STATUS = defineEnum(["ACTIVE", "DELETED"]);

export type FileStatus = (typeof FILE_STATUS)[keyof typeof FILE_STATUS];

/**
 * Stored image sizes (longest side 200, 800 and 1600 px), the blurred public listing photo
 * (ADR-127), and the one variant of a PDF.
 */
export const FILE_VARIANT = defineEnum(["thumb", "medium", "large", "blurred", "document"]);

export type FileVariant = (typeof FILE_VARIANT)[keyof typeof FILE_VARIANT];

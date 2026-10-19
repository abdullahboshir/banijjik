const BYTES_PER_MEGABYTE = 1024 * 1024;
const BYTES_PER_GIBIBYTE = 1024 * BYTES_PER_MEGABYTE;
const MILLISECONDS_PER_SECOND = 1000;

/** Largest accepted image, measured on the bytes received (ADR-109). */
export const MAX_IMAGE_UPLOAD_BYTES = 8 * BYTES_PER_MEGABYTE;
/** Largest accepted PDF. */
export const MAX_DOCUMENT_UPLOAD_BYTES = 10 * BYTES_PER_MEGABYTE;
/** An interim ceiling per organization until a package limit key exists (billing card 6.2). */
export const ORGANIZATION_STORAGE_QUOTA_BYTES = BYTES_PER_GIBIBYTE;
/** A whole upload, from the first byte to the last, must finish within this time. */
export const UPLOAD_TIMEOUT_MS = 60 * MILLISECONDS_PER_SECOND;
/** Images above this many pixels are refused before they are decoded (decompression bombs). */
export const MAX_IMAGE_PIXELS = 40_000_000;
/** Long side, in pixels, of each stored image size. */
export const IMAGE_VARIANT_LONG_SIDE = { thumb: 200, medium: 800, large: 1600 } as const;
/** Long side and blur sigma of the public listing-photo preview (ADR-127). */
export const BLURRED_VARIANT_LONG_SIDE = 200;
export const BLURRED_VARIANT_SIGMA = 18;
/** Longest kept original file name; the name is only shown, never used as a path. */
export const ORIGINAL_NAME_MAX_LENGTH = 120;

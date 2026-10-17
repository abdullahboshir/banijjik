export const FILE_TYPE_GROUP = { IMAGE: "IMAGE", DOCUMENT: "DOCUMENT" } as const;

export type FileTypeGroup = (typeof FILE_TYPE_GROUP)[keyof typeof FILE_TYPE_GROUP];

export interface DetectedFileType {
  readonly group: FileTypeGroup;
  readonly mimeType: string;
}

/** Enough leading bytes to tell every accepted type apart. */
export const SNIFF_BYTE_COUNT = 12;

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46];
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50];
const WEBP_FORMAT_OFFSET = 8;

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((expected, index) => bytes[offset + index] === expected);
}

/**
 * The type of a file by its leading bytes, never by its declared type or extension. Anything else,
 * including SVG and HTML (script carriers), is undefined and refused by the caller (ADR-109).
 */
export function detectFileType(leadingBytes: Uint8Array): DetectedFileType | undefined {
  if (startsWith(leadingBytes, JPEG_SIGNATURE)) {
    return { group: FILE_TYPE_GROUP.IMAGE, mimeType: "image/jpeg" };
  }
  if (startsWith(leadingBytes, PNG_SIGNATURE)) {
    return { group: FILE_TYPE_GROUP.IMAGE, mimeType: "image/png" };
  }
  const isWebp =
    startsWith(leadingBytes, RIFF_SIGNATURE) &&
    startsWith(leadingBytes, WEBP_SIGNATURE, WEBP_FORMAT_OFFSET);
  if (isWebp) return { group: FILE_TYPE_GROUP.IMAGE, mimeType: "image/webp" };
  if (startsWith(leadingBytes, PDF_SIGNATURE)) {
    return { group: FILE_TYPE_GROUP.DOCUMENT, mimeType: "application/pdf" };
  }
  return undefined;
}

import { FILE_PURPOSE, type FilePurpose } from "@banijjik/contracts/file";
import { MAX_DOCUMENT_UPLOAD_BYTES, MAX_IMAGE_UPLOAD_BYTES } from "./file-limits.js";
import { FILE_TYPE_GROUP, type FileTypeGroup } from "./file-types.js";

/** PDFs are only for the file field and attachments; every other purpose takes images only. */
const PURPOSES_ACCEPTING_DOCUMENTS: readonly FilePurpose[] = [
  FILE_PURPOSE.CUSTOM_FIELD_FILE,
  FILE_PURPOSE.ATTACHMENT,
];

export function purposeAcceptsGroup(purpose: FilePurpose, group: FileTypeGroup): boolean {
  if (group === FILE_TYPE_GROUP.IMAGE) return true;
  return PURPOSES_ACCEPTING_DOCUMENTS.includes(purpose);
}

/**
 * Hero and section photos are public website assets (card 4.1 F). Selecting this purpose also
 * needs organization-wide website.site.update; file.asset.create alone is not enough.
 */
export function purposeRequiresWebsiteEdit(purpose: FilePurpose): boolean {
  return purpose === FILE_PURPOSE.WEBSITE_IMAGE;
}

export function sizeLimitOfGroup(group: FileTypeGroup): number {
  return group === FILE_TYPE_GROUP.IMAGE ? MAX_IMAGE_UPLOAD_BYTES : MAX_DOCUMENT_UPLOAD_BYTES;
}

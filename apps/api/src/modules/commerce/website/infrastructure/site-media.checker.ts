import {
  FILE_PURPOSE,
  FILE_VISIBILITY,
  FILE_VISIBILITY_BY_PURPOSE,
  type FilePurpose,
} from "@banijjik/contracts/file";
import type { FileReferenceReader } from "../../../core/file/index.js";
import type { SiteMediaChecker } from "../application/ports/site-publication-ports.js";

/**
 * Only a purpose the file module marks PUBLIC may reach a public page, so a protected listing photo
 * can never be placed on a site (decision 6). When the file module adds WEBSITE_IMAGE the same rule
 * accepts it without a change here.
 */
const PUBLIC_PURPOSES: readonly FilePurpose[] = Object.values(FILE_PURPOSE).filter(
  (purpose) => FILE_VISIBILITY_BY_PURPOSE[purpose] === FILE_VISIBILITY.PUBLIC,
);

async function isPublicFile(reader: FileReferenceReader, fileId: string): Promise<boolean> {
  for (const purpose of PUBLIC_PURPOSES) {
    if (await reader.isUsable(fileId, purpose)) return true;
  }
  return false;
}

/**
 * The file module is asked through its own reader, which is organization-filtered: a file id of
 * another business is simply not found (ADR-087). One point read per public purpose per image, the
 * same bounded fan-out the catalog uses to validate offering images, and only on a publish.
 */
export function buildSiteMediaChecker(reader: FileReferenceReader): SiteMediaChecker {
  return {
    async filterUsable(fileIds) {
      const usable = await Promise.all(fileIds.map((fileId) => isPublicFile(reader, fileId)));
      return new Set(fileIds.filter((_fileId, index) => usable[index] === true));
    },
  };
}

import { BRAND_CHECKS } from "@banijjik/contracts";
import { FILE_PURPOSE } from "@banijjik/contracts/file";
const { isReadablePrimaryColor, isVisibleAccentColor } = BRAND_CHECKS;
import { invalidFields } from "../domain/errors.js";
import type { ClearableChanges } from "../domain/clearable.js";
import type { OrganizationBranding } from "../domain/organization.entity.js";
import type { FileReferenceChecker } from "./ports/custom-field-ports.js";

const PATH_PREFIX = "branding";
const LOW_CONTRAST_MESSAGE_KEY = "validation.color_low_contrast";
const FILE_REFERENCE_MESSAGE_KEY = "errors.file_reference_invalid";

interface RefusedField {
  readonly path: string;
  readonly messageKey: string;
}

function colourFailures(changes: ClearableChanges<OrganizationBranding>): RefusedField[] {
  const refused: RefusedField[] = [];
  const { primaryColor, accentColor } = changes;
  if (typeof primaryColor === "string" && !isReadablePrimaryColor(primaryColor)) {
    refused.push({ path: `${PATH_PREFIX}.primaryColor`, messageKey: LOW_CONTRAST_MESSAGE_KEY });
  }
  if (typeof accentColor === "string" && !isVisibleAccentColor(accentColor)) {
    refused.push({ path: `${PATH_PREFIX}.accentColor`, messageKey: LOW_CONTRAST_MESSAGE_KEY });
  }
  return refused;
}

/**
 * The branding rules the request schema cannot state (ADR-114). Colours must be readable (primary
 * 4.5:1 and accent 3:1 against white; the thresholds are `BRANDING_RULES`), and a logo must be an
 * active file of this organization uploaded for the LOGO purpose. Each refusal names its field, so
 * the screen can show it there; the answer is a 400, like any other field error.
 */
export async function assertBrandingAllowed(input: {
  readonly changes: ClearableChanges<OrganizationBranding>;
  readonly fileReferences: FileReferenceChecker;
}): Promise<void> {
  const refused = colourFailures(input.changes);
  const { logoFileId } = input.changes;
  if (typeof logoFileId === "string") {
    const isUsable = await input.fileReferences.isUsable(logoFileId, FILE_PURPOSE.LOGO);
    if (!isUsable) {
      refused.push({ path: `${PATH_PREFIX}.logoFileId`, messageKey: FILE_REFERENCE_MESSAGE_KEY });
    }
  }
  if (refused.length > 0) throw invalidFields(refused);
}

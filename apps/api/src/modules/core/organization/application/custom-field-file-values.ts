import {
  CUSTOM_FIELD_TYPE,
  type CustomFieldType,
  type EffectiveCustomField,
} from "@banijjik/contracts";
import { FILE_PURPOSE, type FilePurpose } from "@banijjik/contracts/file";
import { invalidFields } from "../domain/errors.js";
import type { FileReferenceChecker } from "./ports/custom-field-ports.js";

const REQUEST_PATH_PREFIX = "customFields";
const FILE_REFERENCE_MESSAGE_KEY = "errors.file_reference_invalid";

const PURPOSE_BY_FIELD_TYPE: Partial<Record<CustomFieldType, FilePurpose>> = {
  [CUSTOM_FIELD_TYPE.IMAGE]: FILE_PURPOSE.CUSTOM_FIELD_IMAGE,
  [CUSTOM_FIELD_TYPE.FILE]: FILE_PURPOSE.CUSTOM_FIELD_FILE,
};

/**
 * The values schema only checks that a FILE or IMAGE value is an id (card 2.3). Here the id must
 * also name a usable file of this organization with the matching purpose: another organization's
 * file, a deleted one, or a logo is refused at `customFields.<key>` (ADR-109).
 */
export async function assertFileValuesUsable(input: {
  readonly checker: FileReferenceChecker;
  readonly fields: readonly EffectiveCustomField[];
  readonly requested: Readonly<Record<string, unknown>>;
}): Promise<void> {
  const refused: string[] = [];
  for (const field of input.fields) {
    const purpose = PURPOSE_BY_FIELD_TYPE[field.fieldType];
    const value = input.requested[field.fieldKey];
    if (purpose === undefined || typeof value !== "string") continue;
    if (!(await input.checker.isUsable(value, purpose))) refused.push(field.fieldKey);
  }
  if (refused.length === 0) return;
  throw invalidFields(
    refused.map((fieldKey) => ({
      path: `${REQUEST_PATH_PREFIX}.${fieldKey}`,
      messageKey: FILE_REFERENCE_MESSAGE_KEY,
    })),
  );
}

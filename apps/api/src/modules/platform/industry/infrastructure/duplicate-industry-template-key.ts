import { isDuplicateKeyError } from "../../../../kernel/db/index.js";
import { industryTemplateKeyTaken } from "../domain/errors.js";

/** A duplicate `industryTemplateKey` becomes the 409 the API documents; anything else is unchanged. */
export function toDuplicateIndustryTemplateKeyError(error: unknown): unknown {
  return isDuplicateKeyError(error, "industryTemplateKey") ? industryTemplateKeyTaken() : error;
}

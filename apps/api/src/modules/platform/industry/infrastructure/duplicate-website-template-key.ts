import { isDuplicateKeyError } from "../../../../kernel/db/index.js";
import { websiteTemplateKeyTaken } from "../domain/errors.js";

export function toDuplicateWebsiteTemplateKeyError(error: unknown): unknown {
  if (isDuplicateKeyError(error, "templateKey")) return websiteTemplateKeyTaken();
  return error;
}

export function isDuplicateWebsiteTemplateRevision(error: unknown): boolean {
  return isDuplicateKeyError(error, "websiteTemplateId") && isDuplicateKeyError(error, "revision");
}

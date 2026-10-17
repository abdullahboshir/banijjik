import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { FILE_RULE_KEY } from "@banijjik/contracts/file";

/** Also used for another organization's file, so existence is never revealed (14-API.md section 3). */
export function fileNotFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

export function fileTypeNotAllowed(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.UNSUPPORTED_MEDIA_TYPE,
    messageKey: "errors.file_type_not_allowed",
  });
}

export function fileTooLarge(maxBytes: number): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.PAYLOAD_TOO_LARGE,
    messageKey: "errors.file_too_large",
    details: { maxBytes },
  });
}

export function fileQuotaExceeded(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.file_quota_exceeded",
    details: { ruleKey: FILE_RULE_KEY.FILE_QUOTA_EXCEEDED },
  });
}

/** A malformed request: no file, a second file, an unknown purpose, or a stalled upload. */
export function invalidUpload(path: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { fields: [{ path, messageKey: "errors.file_upload_invalid" }] },
  });
}

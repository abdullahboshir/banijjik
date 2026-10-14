import { DomainRuleError, ERROR_CODE, SETTINGS_RULE_KEY } from "@banijjik/contracts";

/** The key is not registered, or its module is not effective for this organization. */
export function settingNotAvailable(settingKey: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.NOT_FOUND,
    messageKey: "errors.setting_not_available",
    details: { settingKey },
  });
}

/** `locationId` was sent for a key that does not allow a location override (ADR-016). */
export function settingNotLocationScoped(settingKey: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.setting_not_location_scoped",
    details: { ruleKey: SETTINGS_RULE_KEY.SETTING_NOT_LOCATION_SCOPED, settingKey },
  });
}

export function invalidSettingValue(index: number): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: {
      fields: [{ path: `items.${index}.value`, messageKey: "validation.invalid_value" }],
    },
  });
}

/** An existing row was written without the version the caller read. */
export function settingVersionRequired(currentVersion: number): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    details: { currentVersion },
  });
}

export function settingsForbidden(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.FORBIDDEN });
}

/** A location of another organization looks the same as one that does not exist (ADR-080). */
export function locationMissing(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

import { DomainRuleError, ERROR_CODE, PLATFORM_RULE_KEY } from "@banijjik/contracts";

export function invalidWebsiteTemplateField(path: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { fields: [{ path, messageKey: "validation.invalid_value" }] },
  });
}

export function websiteTemplateNotFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

export function websiteTemplateKeyTaken(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    messageKey: "errors.website_template_key_taken",
  });
}

export function websiteTemplateTransitionInvalid(input: {
  readonly fromStatus: string;
  readonly toStatus: string;
}): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.INVALID_TRANSITION,
    messageKey: "errors.invalid_transition",
    details: input,
  });
}

export function websiteTemplateArchived(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.website_template_archived",
    details: { ruleKey: PLATFORM_RULE_KEY.WEBSITE_TEMPLATE_ARCHIVED },
  });
}

export function websiteTemplateImageForbidden(sectionId: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.website_template_image_forbidden",
    details: {
      ruleKey: PLATFORM_RULE_KEY.WEBSITE_TEMPLATE_IMAGE_FORBIDDEN,
      sectionId,
    },
  });
}

/** A field of an industry template failed its format or catalogue check. */
export function invalidIndustryTemplateField(path: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { fields: [{ path, messageKey: "validation.invalid_value" }] },
  });
}

/** No template with this id or key. An unknown change-template target is 404. */
export function industryTemplateNotFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

/** The key already belongs to a template, including one created a moment ago. */
export function industryTemplateKeyTaken(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.CONFLICT,
    messageKey: "errors.industry_template_key_taken",
  });
}

/** Publish and retire only follow the allowed edges, and a retired template cannot be assigned. */
export function industryTemplateStatusInvalid(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.industry_template_status_invalid",
    details: { ruleKey: PLATFORM_RULE_KEY.INDUSTRY_TEMPLATE_STATUS_INVALID },
  });
}

/** A registered setting default does not match its spec (ADR-106). Unregistered keys are not listed here. */
export function industryTemplateSettingInvalid(settingKeys: readonly string[]): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.industry_template_setting_invalid",
    details: {
      ruleKey: PLATFORM_RULE_KEY.INDUSTRY_TEMPLATE_SETTING_INVALID,
      settingKeys,
    },
  });
}

/** A locked template, or an organization move, would drop something that is already in use. */
export function industryTemplateChangeNotAdditive(removed: readonly string[]): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey: "errors.industry_template_change_not_additive",
    details: {
      ruleKey: PLATFORM_RULE_KEY.INDUSTRY_TEMPLATE_CHANGE_NOT_ADDITIVE,
      removed,
    },
  });
}

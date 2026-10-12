import type { AppConfig, ConfigIssue } from "./app-config.js";
import {
  accessTokenSecretRule,
  accessTokenTtlRule,
  cookieDomainRule,
  isPlaceholderSecret,
  PLACEHOLDER_SECRET_HINT,
  platformAdminEmailRule,
  platformAdminPasswordRule,
  refreshTokenTtlRule,
  sessionFamilyMaxRule,
} from "./env.schema.js";
import {
  collectIssues,
  failure,
  readField,
  readOptionalField,
  type Environment,
  type FieldResult,
} from "./read-field.js";

export interface ConfigSection<Value> {
  readonly value?: Value;
  readonly issues: readonly ConfigIssue[];
}

/** Production refuses the example placeholder: a secret copied from `.env.example` is public. */
function readAccessTokenSecret(env: Environment, isProduction: boolean): FieldResult<string> {
  const result = readField(env, accessTokenSecretRule);
  if (!isProduction || result.value === undefined) return result;
  if (!isPlaceholderSecret(result.value)) return result;
  return failure(accessTokenSecretRule, "INVALID", PLACEHOLDER_SECRET_HINT);
}

/** Session and token settings (card 1.1). Nothing here is ever printed. */
export function readAuthConfig(
  env: Environment,
  isProduction: boolean,
): ConfigSection<AppConfig["auth"]> {
  const accessTokenSecret = readAccessTokenSecret(env, isProduction);
  const accessTokenTtlSeconds = readField(env, accessTokenTtlRule);
  const refreshTokenTtlDays = readField(env, refreshTokenTtlRule);
  const sessionFamilyMaxDays = readField(env, sessionFamilyMaxRule);
  const cookieDomain = readOptionalField(env, cookieDomainRule);
  const issues = collectIssues([
    accessTokenSecret,
    accessTokenTtlSeconds,
    refreshTokenTtlDays,
    sessionFamilyMaxDays,
    cookieDomain,
  ]);
  if (
    issues.length > 0 ||
    accessTokenSecret.value === undefined ||
    accessTokenTtlSeconds.value === undefined ||
    refreshTokenTtlDays.value === undefined ||
    sessionFamilyMaxDays.value === undefined
  ) {
    return { issues };
  }
  return {
    issues,
    value: Object.freeze({
      accessTokenSecret: accessTokenSecret.value,
      accessTokenTtlSeconds: accessTokenTtlSeconds.value,
      refreshTokenTtlDays: refreshTokenTtlDays.value,
      sessionFamilyMaxDays: sessionFamilyMaxDays.value,
      ...(cookieDomain.value === undefined ? {} : { cookieDomain: cookieDomain.value }),
    }),
  };
}

/** The seeded platform admin: both keys or neither. Neither means "no seed". */
export function readPlatformAdmin(
  env: Environment,
): ConfigSection<NonNullable<AppConfig["platformAdmin"]>> {
  const email = readOptionalField(env, platformAdminEmailRule);
  const password = readOptionalField(env, platformAdminPasswordRule);
  const issues = collectIssues([email, password]);
  if (issues.length > 0) return { issues };
  if (email.value !== undefined && password.value !== undefined) {
    return { issues, value: Object.freeze({ email: email.value, password: password.value }) };
  }
  if (email.value === undefined && password.value === undefined) return { issues };
  const missingRule =
    email.value === undefined ? platformAdminEmailRule : platformAdminPasswordRule;
  return { issues: [{ key: missingRule.key, problem: "MISSING", hint: missingRule.hint }] };
}

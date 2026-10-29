import type { StorefrontConfig } from "./app-config.js";
import {
  DEVELOPMENT_OTP_SECRET,
  isPlaceholderSecret,
  otpSecretRule,
  PLACEHOLDER_SECRET_HINT,
  smsDriverRule,
  SMS_TEST_INBOX_IN_PRODUCTION_HINT,
  storefrontBaseDomainRule,
  storefrontReservedHostnamesRule,
  splitOrigins,
} from "./env.schema.js";
import type { ConfigSection } from "./read-auth-config.js";
import {
  collectIssues,
  failure,
  readField,
  type Environment,
  type FieldResult,
} from "./read-field.js";

const DEVELOPMENT_BASE_DOMAIN = "localhost";

/** Production needs a secret of its own: a missing, short or placeholder one is refused. Elsewhere a fixed development one is used. */
function readOtpSecret(env: Environment, isProduction: boolean): FieldResult<string> {
  if (!isProduction)
    return readField(env, { ...otpSecretRule, defaultValue: DEVELOPMENT_OTP_SECRET });
  const result = readField(env, otpSecretRule);
  if (result.value === undefined || !isPlaceholderSecret(result.value)) return result;
  return failure(otpSecretRule, "INVALID", PLACEHOLDER_SECRET_HINT);
}

/** Production never uses the test inbox; until a provider is chosen it runs with the driver `disabled`, which turns customer sign-in off. */
function readSmsDriver(
  env: Environment,
  isProduction: boolean,
): FieldResult<StorefrontConfig["smsDriver"]> {
  const rule = { ...smsDriverRule, defaultValue: isProduction ? "disabled" : "test-inbox" };
  const result = readField(env, rule);
  if (isProduction && result.value === "test-inbox") {
    return failure(smsDriverRule, "INVALID", SMS_TEST_INBOX_IN_PRODUCTION_HINT);
  }
  return result;
}

/** Customer sign-in settings (card M.1). Nothing here is ever printed. */
export function readStorefrontConfig(
  env: Environment,
  isProduction: boolean,
): ConfigSection<StorefrontConfig> {
  const otpSecret = readOtpSecret(env, isProduction);
  const smsDriver = readSmsDriver(env, isProduction);
  const baseDomain = readField(
    env,
    isProduction
      ? storefrontBaseDomainRule
      : { ...storefrontBaseDomainRule, defaultValue: DEVELOPMENT_BASE_DOMAIN },
  );
  const reservedRule = {
    ...storefrontReservedHostnamesRule,
    ...(!isProduction ? { defaultValue: "" } : {}),
  };
  const reservedHostnames = readField(env, reservedRule);
  const hasProductionReservations =
    !isProduction ||
    reservedHostnames.value === undefined ||
    splitOrigins(reservedHostnames.value).length > 0;
  const reservationResult = hasProductionReservations
    ? reservedHostnames
    : failure(storefrontReservedHostnamesRule, "INVALID");
  const issues = collectIssues([otpSecret, smsDriver, baseDomain, reservationResult]);
  if (
    otpSecret.value === undefined ||
    smsDriver.value === undefined ||
    baseDomain.value === undefined ||
    reservationResult.value === undefined
  ) {
    return { issues };
  }
  return {
    issues,
    value: Object.freeze({
      otpSecret: otpSecret.value,
      smsDriver: smsDriver.value,
      baseDomain: baseDomain.value.toLowerCase(),
      reservedHostnames: splitOrigins(reservationResult.value).map((hostname) =>
        hostname.toLowerCase(),
      ),
    }),
  };
}

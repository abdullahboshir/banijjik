import { z } from "zod";

export const NODE_ENVIRONMENTS = ["development", "test", "production"] as const;
export const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace"] as const;

// A host after the scheme, after credentials or after a comma (MongoDB host lists). The optional dot is the
// fully qualified spelling of the same machine ("localhost."), which DNS resolves just the same.
const LOCAL_HOST_PATTERN = /(^|[@,/])(localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?)\.?(?=[:,/?]|$)/i;
const MONGO_URL_PATTERN = /^mongodb(\+srv)?:\/\/[^/\s]+\/[^/?\s]+/;
const REDIS_URL_PATTERN = /^rediss?:\/\/\S+$/;

export function isLocalHostUrl(value: string): boolean {
  return LOCAL_HOST_PATTERN.test(value);
}

const portSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(65535));

/** Splits, trims and de-duplicates a comma-separated list. Empty entries are dropped. */
export function splitOrigins(value: string): string[] {
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return [...new Set(entries)];
}

export function isHttpOrigin(value: string): boolean {
  try {
    const parsed = new URL(value);
    const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
    return isHttp && parsed.origin === value;
  } catch {
    return false;
  }
}

export interface FieldRule<Output> {
  readonly key: string;
  /** A fixed sentence per rule. It is never derived from the value. */
  readonly hint: string;
  readonly schema: z.ZodType<Output, string>;
  readonly defaultValue?: string;
}

const MONGO_HINT = "must be a mongodb:// or mongodb+srv:// URL with a database name";

export const nodeEnvRule: FieldRule<(typeof NODE_ENVIRONMENTS)[number]> = {
  key: "NODE_ENV",
  hint: "must be development, test or production",
  schema: z.enum(NODE_ENVIRONMENTS),
  defaultValue: "development",
};

export const portRule: FieldRule<number> = {
  key: "PORT",
  hint: "must be an integer from 1 to 65535",
  schema: portSchema,
  defaultValue: "4000",
};

export const logLevelRule: FieldRule<(typeof LOG_LEVELS)[number]> = {
  key: "LOG_LEVEL",
  hint: "must be one of fatal, error, warn, info, debug, trace",
  schema: z.enum(LOG_LEVELS),
  defaultValue: "info",
};

export const ROLES = ["api", "worker"] as const;

export const roleRule: FieldRule<(typeof ROLES)[number]> = {
  key: "ROLE",
  hint: "must be api or worker",
  schema: z.enum(ROLES),
  defaultValue: "api",
};

export const platformUrlRule: FieldRule<string> = {
  key: "DB_PLATFORM_URL",
  hint: MONGO_HINT,
  schema: z.string().regex(MONGO_URL_PATTERN),
};

export const tenantSharedUrlRule: FieldRule<string> = {
  key: "DB_TENANT_SHARED_URL",
  hint: MONGO_HINT,
  schema: z.string().regex(MONGO_URL_PATTERN),
};

export const redisUrlRule: FieldRule<string> = {
  key: "REDIS_URL",
  hint: "must be a redis:// or rediss:// URL",
  schema: z.string().regex(REDIS_URL_PATTERN),
};

export const corsRule: FieldRule<string> = {
  key: "CORS_ALLOWED_ORIGINS",
  hint: "must be a comma-separated list of absolute http(s) origins without a path",
  schema: z.string(),
};

export const PRODUCTION_LOCAL_HOST_HINT = "must not point to localhost in production";
export const PLACEHOLDER_SECRET_HINT =
  "must not be the placeholder of .env.example: generate a random value of your own";
export const ALLOW_LOCAL_SERVICES_HINT =
  "is accepted as true only in CI or under the test runner, never in a real production process";

/** The `.env.example` secret is "change-me-...", so one marker covers it and every lookalike. */
const PLACEHOLDER_SECRET_MARKER = "change-me";

export function isPlaceholderSecret(value: string): boolean {
  return value.toLowerCase().includes(PLACEHOLDER_SECRET_MARKER);
}

/** Only a CI run or the test runner may start a production-mode process against local services. */
export function isTestEnvironment(env: Readonly<Record<string, string | undefined>>): boolean {
  return env["CI"] === "true" || (env["VITEST"] ?? "") !== "";
}

export const allowLocalServicesRule: FieldRule<boolean> = {
  key: "ALLOW_LOCAL_SERVICES",
  hint: "must be true or false",
  schema: z.enum(["true", "false"]).transform((text) => text === "true"),
  defaultValue: "false",
};
/** Credentials mode cannot use a wildcard, and the cors package would not match it anyway. */
export const WILDCARD_ORIGIN_HINT = "must not contain a wildcard; list explicit origins";

const positiveInteger = (maximum: number): z.ZodType<number, string> =>
  z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(maximum));

const MINIMUM_SECRET_LENGTH = 32;
const COOKIE_DOMAIN_PATTERN =
  /^\.?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

/** A single digit 0 to 5: how many reverse proxies sit between the internet and the API. */
export const trustedProxyHopsRule: FieldRule<number> = {
  key: "TRUSTED_PROXY_HOPS",
  hint: "must be an integer from 0 to 5: the number of reverse proxies in front of the API",
  schema: z
    .string()
    .regex(/^[0-5]$/)
    .transform(Number),
};

export const outboxPollIntervalRule: FieldRule<number> = {
  key: "OUTBOX_POLL_INTERVAL_MS",
  hint: "must be an integer from 1 to 60000",
  schema: positiveInteger(60_000),
};

export const accessTokenSecretRule: FieldRule<string> = {
  key: "AUTH_ACCESS_TOKEN_SECRET",
  hint: `must be a random string of at least ${MINIMUM_SECRET_LENGTH} characters`,
  schema: z.string().min(MINIMUM_SECRET_LENGTH),
};

export const accessTokenTtlRule: FieldRule<number> = {
  key: "AUTH_ACCESS_TOKEN_TTL_SECONDS",
  hint: "must be an integer from 1 to 86400",
  schema: positiveInteger(86_400),
  defaultValue: "900",
};

export const refreshTokenTtlRule: FieldRule<number> = {
  key: "AUTH_REFRESH_TOKEN_TTL_DAYS",
  hint: "must be an integer from 1 to 365",
  schema: positiveInteger(365),
  defaultValue: "30",
};

export const sessionFamilyMaxRule: FieldRule<number> = {
  key: "AUTH_SESSION_FAMILY_MAX_DAYS",
  hint: "must be an integer from 1 to 730",
  schema: positiveInteger(730),
  defaultValue: "90",
};

export const cookieDomainRule: FieldRule<string> = {
  key: "COOKIE_DOMAIN",
  hint: "must be a host name such as .example.com",
  schema: z.string().regex(COOKIE_DOMAIN_PATTERN),
};

export const platformAdminEmailRule: FieldRule<string> = {
  key: "PLATFORM_ADMIN_EMAIL",
  hint: "must be an email address, and PLATFORM_ADMIN_PASSWORD must be set with it",
  schema: z
    .string()
    .max(254)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
};

export const platformAdminPasswordRule: FieldRule<string> = {
  key: "PLATFORM_ADMIN_PASSWORD",
  hint: "must be set together with PLATFORM_ADMIN_EMAIL",
  schema: z.string().min(1),
};

import { z } from "zod";
import type { ConfigIssue } from "./app-config.js";
import { collectIssues, readField, type Environment } from "./read-field.js";

const DEFAULT_API_BASE = "https://api.cloudflare.com/client/v4";
const TOGETHER_HINT = "token, zone id and fallback origin must be set together, or all omitted";

const tokenSchema = z.string().trim().max(200);
const zoneIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{32}$/);
const hostnamePattern =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
const fallbackOriginSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((value) => value.length === 0 || hostnamePattern.test(value));
const apiBaseSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
  })
  .transform((value) => value.replace(/\/+$/, ""));

export type CloudflareConfig =
  | { readonly driver: "disabled" }
  | {
      readonly driver: "cloudflare";
      readonly apiToken: string;
      readonly zoneId: string;
      readonly fallbackOrigin: string;
      readonly apiBaseUrl: string;
    };

/**
 * SaaS custom-hostname credentials. Token, zone and fallback origin come together or not at all.
 * Neither secret nor zone id is placed in a ConfigError message.
 */
export function readCloudflareConfig(env: Environment): {
  readonly issues: readonly ConfigIssue[];
  readonly value?: CloudflareConfig;
} {
  const token = readField(env, {
    key: "CLOUDFLARE_API_TOKEN",
    hint: "must be a Cloudflare API token of at least 20 characters",
    schema: tokenSchema,
    defaultValue: "",
  });
  const zoneId = readField(env, {
    key: "CLOUDFLARE_ZONE_ID",
    hint: "must be a 32-character hex zone id",
    schema: z.string().trim(),
    defaultValue: "",
  });
  const fallbackOrigin = readField(env, {
    key: "CLOUDFLARE_FALLBACK_ORIGIN",
    hint: "must be a hostname with no scheme or port",
    schema: fallbackOriginSchema,
    defaultValue: "",
  });
  const apiBaseUrl = readField(env, {
    key: "CLOUDFLARE_API_BASE_URL",
    hint: "must be an HTTPS URL without credentials, query or fragment",
    schema: apiBaseSchema,
    defaultValue: DEFAULT_API_BASE,
  });
  const issues = collectIssues([token, zoneId, fallbackOrigin, apiBaseUrl]);
  if (
    token.value === undefined ||
    zoneId.value === undefined ||
    fallbackOrigin.value === undefined ||
    apiBaseUrl.value === undefined
  ) {
    return { issues };
  }
  return assembleCloudflare({
    issues,
    token: token.value,
    zoneId: zoneId.value,
    fallbackOrigin: fallbackOrigin.value,
    apiBaseUrl: apiBaseUrl.value,
  });
}

function assembleCloudflare(input: {
  readonly issues: readonly ConfigIssue[];
  readonly token: string;
  readonly zoneId: string;
  readonly fallbackOrigin: string;
  readonly apiBaseUrl: string;
}): { readonly issues: readonly ConfigIssue[]; readonly value?: CloudflareConfig } {
  const present = [input.token, input.zoneId, input.fallbackOrigin].filter(
    (value) => value.length > 0,
  );
  if (present.length === 0) {
    return { issues: input.issues, value: Object.freeze({ driver: "disabled" }) };
  }
  if (present.length < 3 || input.token.length < 20) {
    return {
      issues: [
        ...input.issues,
        { key: "CLOUDFLARE_API_TOKEN", problem: "INVALID", hint: TOGETHER_HINT },
      ],
    };
  }
  const zoneParsed = zoneIdSchema.safeParse(input.zoneId);
  if (!zoneParsed.success) {
    return {
      issues: [
        ...input.issues,
        {
          key: "CLOUDFLARE_ZONE_ID",
          problem: "INVALID",
          hint: "must be a 32-character hex zone id",
        },
      ],
    };
  }
  return {
    issues: input.issues,
    value: Object.freeze({
      driver: "cloudflare",
      apiToken: input.token,
      zoneId: zoneParsed.data,
      fallbackOrigin: input.fallbackOrigin,
      apiBaseUrl: input.apiBaseUrl,
    }),
  };
}

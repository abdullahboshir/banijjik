import type { AuthRateLimit } from "./auth-limits.js";

const ONE_MINUTE_SECONDS = 60;
const PIN_LOCK_MINUTES = 15;
const MAX_PIN_FAILURES = 5;
const TOKEN_TTL_SECONDS = 2 * 60;

/** PIN lock and token lifetime (ADR-121). */
export const APPROVAL_PIN_RULES = {
  maxFailures: MAX_PIN_FAILURES,
  lockMinutes: PIN_LOCK_MINUTES,
  tokenTtlSeconds: TOKEN_TTL_SECONDS,
} as const;

/** Per-IP and per-organization buckets for `POST /approvals`. */
export const APPROVAL_RATE_LIMIT = {
  PER_IP: {
    bucket: "iam.approval.ip",
    limit: 30,
    windowSeconds: ONE_MINUTE_SECONDS,
  },
  PER_ORG: {
    bucket: "iam.approval.org",
    limit: 60,
    windowSeconds: ONE_MINUTE_SECONDS,
  },
} as const satisfies Record<string, AuthRateLimit>;

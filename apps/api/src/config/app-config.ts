import type { CloudflareConfig } from "./read-cloudflare-config.js";
import type { SmsConfig } from "./read-sms-config.js";

/** Where uploaded files are stored (ADR-109). Credentials are never logged. */
export type StorageConfig =
  | { readonly driver: "local"; readonly localRoot: string }
  | {
      readonly driver: "s3";
      readonly bucket: string;
      readonly region: string;
      readonly endpoint?: string;
      readonly accessKeyId: string;
      readonly secretAccessKey: string;
    };

/** Customer sign-in on the public site (card M.1, ADR-119). Neither secret nor driver is ever logged. */
export interface StorefrontConfig {
  /** Seals and hashes one-time codes. */
  readonly otpSecret: string;
  readonly smsDriver: "test-inbox" | "disabled" | "gateway";
  /** `<slug>.<baseDomain>` is the public host of a business. */
  readonly baseDomain: string;
  /** Public platform, API and admin hosts that no tenant may claim. */
  readonly reservedHostnames: readonly string[];
}

export interface AppConfig {
  readonly sms: SmsConfig;
  readonly nodeEnv: "development" | "test" | "production";
  readonly port: number;
  readonly logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
  readonly role: "api" | "worker";
  readonly database: {
    readonly platformUrl: string;
    readonly tenantSharedUrl: string;
  };
  readonly redisUrl: string;
  /**
   * How many reverse proxies stand in front of the API; Express believes that many `X-Forwarded-For`
   * entries and no more. 0 means the socket address is the client (review M7).
   */
  readonly trustedProxyHops: number;
  /** How often the worker looks for pending outbox events. Absent means the dispatcher default (500 ms). */
  readonly outboxPollIntervalMs?: number;
  readonly corsAllowedOrigins: readonly string[];
  readonly storage: StorageConfig;
  readonly storefront: StorefrontConfig;
  readonly cloudflare: CloudflareConfig;
  readonly auth: {
    /** Signs access tokens. Never logged. */
    readonly accessTokenSecret: string;
    readonly accessTokenTtlSeconds: number;
    readonly refreshTokenTtlDays: number;
    readonly sessionFamilyMaxDays: number;
    readonly cookieDomain?: string;
  };
  /** Present only when both PLATFORM_ADMIN_* keys are set; read by the seed script alone. */
  readonly platformAdmin?: { readonly email: string; readonly password: string };
}

export interface ConfigIssue {
  readonly key: string;
  readonly problem: "MISSING" | "INVALID";
  /** A fixed sentence per rule. It is never derived from the value. */
  readonly hint: string;
}

export class ConfigError extends Error {
  readonly issues: readonly ConfigIssue[];

  constructor(issues: readonly ConfigIssue[]) {
    // Keys and problems only: a secret that failed validation must not reach logs.
    const lines = issues.map((issue) => `${issue.key}: ${issue.problem} (${issue.hint})`);
    super(`Invalid configuration:\n${lines.join("\n")}`);
    this.name = "ConfigError";
    this.issues = issues;
  }
}

export interface AppConfig {
  readonly nodeEnv: "development" | "test" | "production";
  readonly port: number;
  readonly logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
  readonly database: {
    readonly platformUrl: string;
    readonly tenantSharedUrl: string;
  };
  readonly redisUrl: string;
  readonly corsAllowedOrigins: readonly string[];
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

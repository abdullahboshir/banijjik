import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigError, loadConfig, loadConfigFromProcess, loadEnvFile } from "./index.js";

const FAKE_ACCESS_SECRET = "test-only-access-secret-0123456789abcdef";

const validEnv = {
  AUTH_ACCESS_TOKEN_SECRET: FAKE_ACCESS_SECRET,
  DB_PLATFORM_URL:
    "mongodb://127.0.0.1:27018/platform_database?replicaSet=rs0&directConnection=true",
  DB_TENANT_SHARED_URL:
    "mongodb://127.0.0.1:27018/tenant_shared_database?replicaSet=rs0&directConnection=true",
  REDIS_URL: "redis://127.0.0.1:6380",
  CORS_ALLOWED_ORIGINS: "http://localhost:3000, https://admin.example.com, http://localhost:3000",
};

const productionEnv = {
  AUTH_ACCESS_TOKEN_SECRET: FAKE_ACCESS_SECRET,
  NODE_ENV: "production",
  DB_PLATFORM_URL: "mongodb+srv://user:pw@cluster.example.com/platform",
  DB_TENANT_SHARED_URL: "mongodb+srv://user:pw@cluster.example.com/tenant",
  REDIS_URL: "rediss://cache.example.com:6380",
  CORS_ALLOWED_ORIGINS: "https://app.example.com",
};

function catchConfigError(env: Record<string, string | undefined>): ConfigError {
  try {
    loadConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) return error;
    throw error;
  }
  throw new Error("expected loadConfig to throw ConfigError");
}

describe("loadConfig", () => {
  it("returns a frozen config with origins parsed, trimmed and de-duplicated", () => {
    const config = loadConfig({ ...validEnv, NODE_ENV: "test", PORT: "5000", LOG_LEVEL: "debug" });

    expect(config).toEqual({
      nodeEnv: "test",
      port: 5000,
      logLevel: "debug",
      role: "api",
      database: {
        platformUrl: validEnv.DB_PLATFORM_URL,
        tenantSharedUrl: validEnv.DB_TENANT_SHARED_URL,
      },
      redisUrl: validEnv.REDIS_URL,
      corsAllowedOrigins: ["http://localhost:3000", "https://admin.example.com"],
      auth: {
        accessTokenSecret: FAKE_ACCESS_SECRET,
        accessTokenTtlSeconds: 900,
        refreshTokenTtlDays: 30,
        sessionFamilyMaxDays: 90,
      },
    });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.database)).toBe(true);
    expect(Object.isFrozen(config.auth)).toBe(true);
  });

  it("accepts ROLE=worker", () => {
    expect(loadConfig({ ...validEnv, ROLE: "worker" }).role).toBe("worker");
  });

  it("applies defaults for NODE_ENV, PORT and LOG_LEVEL", () => {
    const config = loadConfig(validEnv);

    expect(config.nodeEnv).toBe("development");
    expect(config.port).toBe(4000);
    expect(config.logLevel).toBe("info");
    expect(config.role).toBe("api");
  });

  it.each([
    "DB_PLATFORM_URL",
    "DB_TENANT_SHARED_URL",
    "REDIS_URL",
    "CORS_ALLOWED_ORIGINS",
    "AUTH_ACCESS_TOKEN_SECRET",
  ])("reports %s as MISSING when it is absent", (key) => {
    const env: Record<string, string | undefined> = { ...validEnv };
    delete env[key];

    expect(catchConfigError(env).issues).toEqual([
      expect.objectContaining({ key, problem: "MISSING" }),
    ]);
  });

  it("lists every problem in one error, not just the first", () => {
    const error = catchConfigError({ PORT: "abc", LOG_LEVEL: "loud" });

    expect(error.issues.map((issue) => issue.key).sort()).toEqual([
      "AUTH_ACCESS_TOKEN_SECRET",
      "CORS_ALLOWED_ORIGINS",
      "DB_PLATFORM_URL",
      "DB_TENANT_SHARED_URL",
      "LOG_LEVEL",
      "PORT",
      "REDIS_URL",
    ]);
  });

  it.each([
    ["PORT", "abc"],
    ["PORT", "70000"],
    ["PORT", "0"],
    ["DB_PLATFORM_URL", "http://x/db"],
    ["DB_PLATFORM_URL", "mongodb://127.0.0.1:27018"],
    ["DB_TENANT_SHARED_URL", "mongodb://127.0.0.1:27018/"],
    ["REDIS_URL", "foo"],
    ["LOG_LEVEL", "loud"],
    ["ROLE", "admin"],
    ["NODE_ENV", "staging"],
    ["CORS_ALLOWED_ORIGINS", "localhost:3000"],
    ["CORS_ALLOWED_ORIGINS", "https://a.example.com/path"],
    ["AUTH_ACCESS_TOKEN_SECRET", "too-short"],
    ["AUTH_ACCESS_TOKEN_TTL_SECONDS", "0"],
    ["AUTH_REFRESH_TOKEN_TTL_DAYS", "400"],
    ["AUTH_SESSION_FAMILY_MAX_DAYS", "abc"],
    ["COOKIE_DOMAIN", "not a domain"],
    ["PLATFORM_ADMIN_EMAIL", "nobody"],
  ])("reports %s=%s as INVALID", (key, value) => {
    const error = catchConfigError({ ...validEnv, [key]: value });

    expect(error.issues).toEqual([expect.objectContaining({ key, problem: "INVALID" })]);
  });

  it("accepts a production environment with remote services", () => {
    expect(loadConfig(productionEnv).nodeEnv).toBe("production");
  });

  it.each([productionEnv, validEnv])(
    "rejects a wildcard origin in every environment (M3)",
    (env) => {
      const error = catchConfigError({ ...env, CORS_ALLOWED_ORIGINS: "*" });

      expect(error.issues).toEqual([
        {
          key: "CORS_ALLOWED_ORIGINS",
          problem: "INVALID",
          hint: "must not contain a wildcard; list explicit origins",
        },
      ]);
    },
  );

  it("rejects localhost database and Redis URLs in production but accepts them in development", () => {
    const error = catchConfigError({
      ...productionEnv,
      ...validEnv,
      NODE_ENV: "production",
      CORS_ALLOWED_ORIGINS: "https://a.example.com",
    });

    expect(error.issues.map((issue) => issue.key).sort()).toEqual([
      "DB_PLATFORM_URL",
      "DB_TENANT_SHARED_URL",
      "REDIS_URL",
    ]);
    expect(() => loadConfig(validEnv)).not.toThrow();
  });

  it("never includes a secret value in the error message, string form or issues", () => {
    const error = catchConfigError({
      ...validEnv,
      DB_PLATFORM_URL: "mongodb://user:SuperSecret@host/db",
      NODE_ENV: "production",
      PORT: "SuperSecret",
    });

    expect(error.issues.length).toBeGreaterThan(0);
    expect(String(error)).not.toContain("SuperSecret");
    expect(error.message).not.toContain("SuperSecret");
    expect(JSON.stringify(error.issues)).not.toContain("SuperSecret");
    expect(error.stack ?? "").not.toContain("SuperSecret");
  });
});

describe("loadConfig auth settings", () => {
  it("reads the optional overrides and the cookie domain", () => {
    const config = loadConfig({
      ...validEnv,
      AUTH_ACCESS_TOKEN_TTL_SECONDS: "600",
      AUTH_REFRESH_TOKEN_TTL_DAYS: "14",
      AUTH_SESSION_FAMILY_MAX_DAYS: "60",
      COOKIE_DOMAIN: ".example.com",
    });

    expect(config.auth).toEqual({
      accessTokenSecret: FAKE_ACCESS_SECRET,
      accessTokenTtlSeconds: 600,
      refreshTokenTtlDays: 14,
      sessionFamilyMaxDays: 60,
      cookieDomain: ".example.com",
    });
  });

  it("has no platform admin unless both keys are set", () => {
    expect(loadConfig(validEnv).platformAdmin).toBeUndefined();
    expect(
      loadConfig({
        ...validEnv,
        PLATFORM_ADMIN_EMAIL: "admin@example.com",
        PLATFORM_ADMIN_PASSWORD: "a-long-seed-password",
      }).platformAdmin,
    ).toEqual({ email: "admin@example.com", password: "a-long-seed-password" });
  });

  it.each([
    ["PLATFORM_ADMIN_EMAIL", "PLATFORM_ADMIN_PASSWORD", "admin@example.com"],
    ["PLATFORM_ADMIN_PASSWORD", "PLATFORM_ADMIN_EMAIL", "a-long-seed-password"],
  ])("reports %s alone as a missing %s", (presentKey, missingKey, value) => {
    const error = catchConfigError({ ...validEnv, [presentKey]: value });

    expect(error.issues).toEqual([
      expect.objectContaining({ key: missingKey, problem: "MISSING" }),
    ]);
  });

  it("never echoes the secret or the seed password in an error", () => {
    const error = catchConfigError({
      ...validEnv,
      AUTH_ACCESS_TOKEN_SECRET: "short-secret-value",
      PLATFORM_ADMIN_EMAIL: "SeedPasswordLeak",
      PLATFORM_ADMIN_PASSWORD: "SeedPasswordLeak",
    });

    expect(JSON.stringify(error.issues) + String(error)).not.toMatch(
      /short-secret-value|SeedPasswordLeak/,
    );
  });
});

describe("loadEnvFile", () => {
  const directories: string[] = [];

  afterEach(() => {
    delete process.env.CONFIG_TEST_NEW;
    delete process.env.CONFIG_TEST_KEPT;
    for (const directory of directories.splice(0))
      rmSync(directory, { recursive: true, force: true });
  });

  it("does not throw when the file is missing", () => {
    expect(() => loadEnvFile(join(tmpdir(), "test-missing-dir", ".env"))).not.toThrow();
  });

  it("sets variables from the file without overriding ones already set", () => {
    const directory = mkdtempSync(join(tmpdir(), "test-env-"));
    directories.push(directory);
    const path = join(directory, ".env");
    writeFileSync(path, "CONFIG_TEST_NEW=from-file\nCONFIG_TEST_KEPT=from-file\n");
    process.env.CONFIG_TEST_KEPT = "already-set";

    loadEnvFile(path);

    expect(process.env.CONFIG_TEST_NEW).toBe("from-file");
    expect(process.env.CONFIG_TEST_KEPT).toBe("already-set");
  });
});

describe("loadConfigFromProcess", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv);
  });

  it("builds the config from the env file while an already-set variable wins", () => {
    const directory = mkdtempSync(join(tmpdir(), "test-process-"));
    const path = join(directory, ".env");
    const fileLines = Object.entries(validEnv).map(([key, value]) => `${key}=${value}`);
    writeFileSync(path, [...fileLines, "PORT=5001"].join("\n"));
    process.env.PORT = "6000";
    try {
      const config = loadConfigFromProcess(path);

      expect(config.port).toBe(6000);
      expect(config.redisUrl).toBe(validEnv.REDIS_URL);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

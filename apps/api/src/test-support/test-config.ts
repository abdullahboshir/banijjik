import { loadConfig, type AppConfig } from "../config/index.js";

export const ALLOWED_ORIGIN = "http://localhost:3000";
/** A clearly fake access-token secret, long enough to pass the config check. */
export const TEST_ACCESS_TOKEN_SECRET = "test-only-access-secret-0123456789abcdef";

/** A valid config for tests. Nothing connects to these URLs. */
export function createTestConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: "test",
    DB_PLATFORM_URL: "mongodb://127.0.0.1:27018/platform_test",
    DB_TENANT_SHARED_URL: "mongodb://127.0.0.1:27018/tenant_test",
    REDIS_URL: "redis://127.0.0.1:6380",
    CORS_ALLOWED_ORIGINS: ALLOWED_ORIGIN,
    AUTH_ACCESS_TOKEN_SECRET: TEST_ACCESS_TOKEN_SECRET,
    // The test client plays the one proxy in front of the API: it sends X-Forwarded-For to pick its address.
    TRUSTED_PROXY_HOPS: "1",
    ...overrides,
  });
}

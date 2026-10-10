import { loadConfig, type AppConfig } from "../config/index.js";

export const ALLOWED_ORIGIN = "http://localhost:3000";

/** A valid config for tests. Nothing connects to these URLs. */
export function createTestConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: "test",
    DB_PLATFORM_URL: "mongodb://127.0.0.1:27018/platform_test",
    DB_TENANT_SHARED_URL: "mongodb://127.0.0.1:27018/tenant_test",
    REDIS_URL: "redis://127.0.0.1:6379",
    CORS_ALLOWED_ORIGINS: ALLOWED_ORIGIN,
    ...overrides,
  });
}

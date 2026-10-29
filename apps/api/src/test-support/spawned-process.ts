import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { redisUrlOrUnreachable } from "./test-redis.js";
import { TEST_ACCESS_TOKEN_SECRET, TEST_CREDENTIALS_ENCRYPTION_KEY } from "./test-config.js";
import type { TestDatabaseUrls } from "./test-databases.js";

const PACKAGE_FOLDER = fileURLToPath(new URL("../..", import.meta.url));
const TEXT_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 50;
export interface SpawnedProcess {
  output(): string;
  waitForText(text: string): Promise<void>;
  waitForExit(): Promise<number | null>;
}

const started: ChildProcess[] = [];

/** Runs a TypeScript entry of the api package with exactly the environment given, like main.test.ts does. */
export function spawnApiEntry(entry: string, environment: Record<string, string>): SpawnedProcess {
  const child = spawn(process.execPath, ["--import", "tsx", entry], {
    cwd: PACKAGE_FOLDER,
    env: environment,
  });
  started.push(child);
  let collected = "";
  child.stdout.on("data", (chunk: Buffer) => (collected += chunk.toString()));
  child.stderr.on("data", (chunk: Buffer) => (collected += chunk.toString()));
  const exited = new Promise<number | null>((resolve) => child.once("exit", resolve));
  return {
    output: () => collected,
    waitForExit: () => exited,
    waitForText: async (text) => {
      const deadline = Date.now() + TEXT_TIMEOUT_MS;
      while (!collected.includes(text)) {
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${text}:\n${collected}`);
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    },
  };
}

export function stopSpawnedProcesses(): void {
  for (const child of started.splice(0)) child.kill();
}

export async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

/** The environment of a process that believes it runs in production, against the test databases. */
export function productionEnvironment(
  databases: TestDatabaseUrls,
  port: number,
  role: "api" | "worker",
): Record<string, string> {
  return {
    NODE_ENV: "production",
    ROLE: role,
    PORT: String(port),
    DB_PLATFORM_URL: databases.platformUrl,
    DB_TENANT_SHARED_URL: databases.tenantSharedUrl,
    REDIS_URL: redisUrlOrUnreachable(),
    CORS_ALLOWED_ORIGINS: "http://localhost:3000",
    AUTH_ACCESS_TOKEN_SECRET: TEST_ACCESS_TOKEN_SECRET,
    CREDENTIALS_ENCRYPTION_KEY: TEST_CREDENTIALS_ENCRYPTION_KEY,
    TRUSTED_PROXY_HOPS: "1",
    // Production needs these customer sign-in settings (card M.1); the values are fake.
    OTP_SECRET: "test-only-otp-secret-0123456789abcdef0123",
    STOREFRONT_BASE_DOMAIN: "sites.example.com",
    STOREFRONT_RESERVED_HOSTNAMES: "admin.example.com,api.example.com,platform.example.com",
    // The test servers are local, which production config refuses. It accepts this flag only from a
    // process that says it is a test (CI or VITEST), so no real deployment can use it.
    ALLOW_LOCAL_SERVICES: "true",
    VITEST: "true",
  };
}

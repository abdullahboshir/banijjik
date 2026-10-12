import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { redisUrlOrUnreachable } from "./test-redis.js";
import { TEST_ACCESS_TOKEN_SECRET } from "./test-config.js";
import type { TestDatabaseUrls } from "./test-databases.js";

const PACKAGE_FOLDER = fileURLToPath(new URL("../..", import.meta.url));
const TEXT_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 50;
/**
 * Config refuses "localhost" and "127.0.0.1" in production. A trailing dot makes it the fully
 * qualified name of the same machine, which the check does not match and DNS still resolves, so a
 * production-mode process can reach the test servers.
 */
const LOOPBACK_FULLY_QUALIFIED = "localhost.";

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

function useFullyQualifiedLoopback(url: string): string {
  return url.replace("127.0.0.1", LOOPBACK_FULLY_QUALIFIED);
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
    DB_PLATFORM_URL: useFullyQualifiedLoopback(databases.platformUrl),
    DB_TENANT_SHARED_URL: useFullyQualifiedLoopback(databases.tenantSharedUrl),
    REDIS_URL: useFullyQualifiedLoopback(redisUrlOrUnreachable()),
    CORS_ALLOWED_ORIGINS: "http://localhost:3000",
    AUTH_ACCESS_TOKEN_SECRET: TEST_ACCESS_TOKEN_SECRET,
    TRUSTED_PROXY_HOPS: "1",
  };
}

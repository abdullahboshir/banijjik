import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const PACKAGE_FOLDER = fileURLToPath(new URL("..", import.meta.url));
const STARTUP_TIMEOUT_MS = 20_000;
const IS_WINDOWS = process.platform === "win32";

interface RunningProcess {
  readonly child: ChildProcess;
  output(): string;
  waitForText(text: string): Promise<void>;
  waitForExit(): Promise<number | null>;
}

const startedChildren: ChildProcess[] = [];

async function findFreePort(): Promise<number> {
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

function validEnvironment(port: number, role: string): Record<string, string> {
  return {
    NODE_ENV: "test",
    ROLE: role,
    PORT: String(port),
    DB_PLATFORM_URL: "mongodb://127.0.0.1:27018/platform_test",
    DB_TENANT_SHARED_URL: "mongodb://127.0.0.1:27018/tenant_test",
    REDIS_URL: "redis://127.0.0.1:6379",
    CORS_ALLOWED_ORIGINS: "http://localhost:3000",
  };
}

// The child gets only the variables passed here, so nothing from the developer shell or .env leaks in.
function startMain(environment: Record<string, string>): RunningProcess {
  const child = spawn(process.execPath, ["--import", "tsx", "src/main.ts"], {
    cwd: PACKAGE_FOLDER,
    env: environment,
  });
  startedChildren.push(child);
  let collected = "";
  child.stdout.on("data", (chunk: Buffer) => (collected += chunk.toString()));
  child.stderr.on("data", (chunk: Buffer) => (collected += chunk.toString()));
  const exited = new Promise<number | null>((resolve) => child.once("exit", resolve));

  return {
    child,
    output: () => collected,
    waitForExit: () => exited,
    waitForText: async (text) => {
      const deadline = Date.now() + STARTUP_TIMEOUT_MS;
      while (!collected.includes(text)) {
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${text}:\n${collected}`);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    },
  };
}

afterEach(() => {
  for (const child of startedChildren.splice(0)) child.kill();
});

describe("main entry", () => {
  it("exits 1 and logs config.invalid when the environment is missing", async () => {
    const running = startMain({ NODE_ENV: "test" });

    const exitCode = await running.waitForExit();

    expect(exitCode).toBe(1);
    expect(running.output()).toContain('"event":"config.invalid"');
    expect(running.output()).toContain("DB_PLATFORM_URL");
  });

  it(
    "starts the API on ROLE=api and serves /health",
    async () => {
      const port = await findFreePort();
      const running = startMain(validEnvironment(port, "api"));

      await running.waitForText('"event":"api.started"');
      const response = await fetch(`http://127.0.0.1:${port}/health`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { status: "ok" } });
    },
    STARTUP_TIMEOUT_MS,
  );

  it(
    "starts no HTTP server on ROLE=worker",
    async () => {
      const port = await findFreePort();
      const running = startMain(validEnvironment(port, "worker"));

      await running.waitForText('"event":"worker.started"');

      await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow();
    },
    STARTUP_TIMEOUT_MS,
  );

  // Windows emulates SIGTERM for child processes by killing them, so the handler never runs there.
  // registerShutdown itself is covered in kernel/lifecycle/shutdown.test.ts.
  it.skipIf(IS_WINDOWS)(
    "exits 0 with shutdown.completed on SIGTERM",
    async () => {
      const port = await findFreePort();
      const running = startMain(validEnvironment(port, "api"));
      await running.waitForText('"event":"api.started"');

      running.child.kill("SIGTERM");
      const exitCode = await running.waitForExit();

      expect(exitCode).toBe(0);
      expect(running.output()).toContain('"event":"shutdown.completed"');
    },
    STARTUP_TIMEOUT_MS,
  );
});

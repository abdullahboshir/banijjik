import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { TEST_ACCESS_TOKEN_SECRET } from "./test-support/test-config.js";
import { outboxModel, publishTestEvent } from "./test-support/event-fixtures.js";
import { connectDatabases, initializeModels } from "./kernel/db/index.js";
import { registerEventModels } from "./kernel/events/index.js";
import {
  createDatabaseTestConfig,
  createTestDatabaseUrls,
  installTestLogger,
  type TestDatabaseUrls,
} from "./test-support/test-databases.js";
import { describeWithRedis, redisUrlOrUnreachable } from "./test-support/test-redis.js";
import { waitFor } from "./test-support/wait-for.js";

const PACKAGE_FOLDER = fileURLToPath(new URL("..", import.meta.url));
const STARTUP_TIMEOUT_MS = 20_000;
// The driver waits its full server-selection timeout (10 s) before giving up.
const UNREACHABLE_DATABASE_TIMEOUT_MS = 40_000;
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

function validEnvironment(
  port: number,
  role: string,
  databases: TestDatabaseUrls = createTestDatabaseUrls(),
): Record<string, string> {
  return {
    NODE_ENV: "test",
    ROLE: role,
    PORT: String(port),
    DB_PLATFORM_URL: databases.platformUrl,
    DB_TENANT_SHARED_URL: databases.tenantSharedUrl,
    REDIS_URL: redisUrlOrUnreachable(),
    OUTBOX_POLL_INTERVAL_MS: "50",
    CORS_ALLOWED_ORIGINS: "http://localhost:3000",
    AUTH_ACCESS_TOKEN_SECRET: TEST_ACCESS_TOKEN_SECRET,
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
    "seeds the packages at startup and a second start changes nothing",
    async () => {
      const databases = createTestDatabaseUrls();
      installTestLogger();
      const connections = await connectDatabases(createDatabaseTestConfig(databases));
      const packages = () => connections.platform.collection("packages");
      try {
        const first = startMain(validEnvironment(await findFreePort(), "api", databases));
        await first.waitForText('"event":"api.started"');
        const afterFirst = await packages().find({}).sort({ packageKey: 1 }).toArray();
        first.child.kill();
        await first.waitForExit();

        const second = startMain(validEnvironment(await findFreePort(), "worker", databases));
        await second.waitForText('"event":"worker.started"');
        const afterSecond = await packages().find({}).sort({ packageKey: 1 }).toArray();

        expect(afterFirst).toHaveLength(17);
        expect(afterSecond).toEqual(afterFirst);
        expect(second.output()).toContain('"createdCount":0');
      } finally {
        await connections.platform.dropDatabase();
        await connections.tenantShared.dropDatabase();
        await connections.close();
      }
    },
    STARTUP_TIMEOUT_MS * 2,
  );

  it(
    "logs db.connected before api.started and never prints the connection URL",
    async () => {
      const port = await findFreePort();
      const environment = validEnvironment(port, "api");
      const running = startMain(environment);

      await running.waitForText('"event":"api.started"');

      const output = running.output();
      expect(output.indexOf('"event":"db.connected"')).toBeGreaterThanOrEqual(0);
      expect(output.indexOf('"event":"db.connected"')).toBeLessThan(
        output.indexOf('"event":"api.started"'),
      );
      expect(output).not.toContain(environment["DB_PLATFORM_URL"] ?? "unset");
    },
    STARTUP_TIMEOUT_MS,
  );

  it(
    "exits 1 with db.connect_failed when the database cannot be reached",
    async () => {
      const port = await findFreePort();
      const environment = {
        ...validEnvironment(port, "api"),
        DB_PLATFORM_URL: "mongodb://127.0.0.1:1/platform_down",
        DB_TENANT_SHARED_URL: "mongodb://127.0.0.1:1/tenant_down",
      };
      const running = startMain(environment);

      const exitCode = await running.waitForExit();

      expect(exitCode).toBe(1);
      expect(running.output()).toContain('"event":"db.connect_failed"');
      expect(running.output()).not.toContain("127.0.0.1:1/platform_down");
    },
    UNREACHABLE_DATABASE_TIMEOUT_MS,
  );

  it("exits 1 with config.invalid when the two database URLs are on different hosts", async () => {
    const running = startMain({
      ...validEnvironment(await findFreePort(), "api"),
      DB_TENANT_SHARED_URL: "mongodb://other-host.example.com:27017/tenant_test",
    });

    const exitCode = await running.waitForExit();

    expect(exitCode).toBe(1);
    expect(running.output()).toContain('"event":"config.invalid"');
    expect(running.output()).toContain("DB_TENANT_SHARED_URL");
  });
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

registerEventModels();

describeWithRedis("main entry as a worker with Redis", () => {
  it(
    "dispatches a pending outbox event end to end and logs worker.started",
    async () => {
      const databases = createTestDatabaseUrls();
      installTestLogger();
      const connections = await connectDatabases(createDatabaseTestConfig(databases));
      await initializeModels();
      try {
        const event = await publishTestEvent();
        const running = startMain(validEnvironment(await findFreePort(), "worker", databases));

        await running.waitForText('"event":"worker.started"');
        const dispatched = await waitFor(
          "the event to be dispatched",
          async () =>
            (await outboxModel()
              .findOne({ eventId: event.eventId, status: "DISPATCHED" })
              .lean()) ?? undefined,
        );

        expect(dispatched.dispatchedAt).toBeInstanceOf(Date);
      } finally {
        await connections.platform.dropDatabase();
        await connections.tenantShared.dropDatabase();
        await connections.close();
      }
    },
    STARTUP_TIMEOUT_MS,
  );
});

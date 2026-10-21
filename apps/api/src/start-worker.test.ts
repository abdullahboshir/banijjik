import { describe, expect, it } from "vitest";
import { initializeModels } from "./kernel/db/index.js";
import { registerEventModels } from "./kernel/events/index.js";
import { createTestConfig } from "./test-support/test-config.js";
import { connectTestDatabases, installTestLogger } from "./test-support/test-databases.js";
import { redisUrlOrUnreachable } from "./test-support/test-redis.js";
import { startWorker } from "./start-worker.js";
import { withTimeout } from "./kernel/time/index.js";
import { getLogger } from "./kernel/logger/index.js";

registerEventModels();

const SHUTDOWN_TASK_TIMEOUT_MS = 5000;

describe("startWorker", () => {
  it("returns the shutdown tasks in the order scheduled jobs, dispatcher, replayer, worker, queue, redis, databases", async () => {
    installTestLogger();
    const connections = await connectTestDatabases();
    await initializeModels();

    const tasks = startWorker(
      createTestConfig({ REDIS_URL: redisUrlOrUnreachable() }),
      getLogger(),
      connections,
    );
    const names = tasks.map((task) => task.name);
    const databaseTask = tasks.at(-1);
    for (const task of tasks.slice(0, -1)) {
      await withTimeout(
        task.run(),
        SHUTDOWN_TASK_TIMEOUT_MS,
        () => new Error("Shutdown task blocked: " + task.name),
      );
    }
    await databaseTask?.run();

    expect(names).toEqual([
      "scheduled-jobs-worker",
      "scheduled-jobs-queue",
      "stop-dispatcher",
      "stop-replayer",
      "close-worker",
      "close-queue",
      "close-redis",
      "close-databases",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { initializeModels } from "./kernel/db/index.js";
import { registerEventModels } from "./kernel/events/index.js";
import { createTestConfig } from "./test-support/test-config.js";
import { connectTestDatabases, installTestLogger } from "./test-support/test-databases.js";
import { redisUrlOrUnreachable } from "./test-support/test-redis.js";
import { startWorker } from "./start-worker.js";
import { getLogger } from "./kernel/logger/index.js";

registerEventModels();

describe("startWorker", () => {
  it("returns the shutdown tasks in the order dispatcher, replayer, worker, queue, redis, databases", async () => {
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
    for (const task of tasks.slice(0, -1)) await task.run();
    await databaseTask?.run();

    expect(names).toEqual([
      "stop-dispatcher",
      "stop-replayer",
      "close-worker",
      "close-queue",
      "close-redis",
      "close-databases",
    ]);
  });
});

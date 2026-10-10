import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogCapture } from "../../test-support/log-capture.js";
import { connectTestDatabases } from "../../test-support/test-databases.js";
import { registerShutdown } from "../lifecycle/shutdown.js";
import { createLogger } from "../logger/index.js";
import { createCloseDatabasesTask } from "./close-databases-task.js";

describe("createCloseDatabasesTask", () => {
  let removeListeners: () => void = () => undefined;

  afterEach(() => {
    removeListeners();
    process.exitCode = undefined;
  });

  it("disconnects the client when the shutdown tasks run", async () => {
    const logs = createLogCapture();
    const connections = await connectTestDatabases();
    removeListeners = registerShutdown({
      logger: createLogger({ level: "info", destination: logs.destination }),
      tasks: [createCloseDatabasesTask(connections)],
      exit: vi.fn(),
    });
    expect(connections.platform.readyState).toBe(1);

    process.emit("SIGTERM");
    await vi.waitFor(() => expect(logs.text()).toContain("shutdown.completed"));

    expect(connections.platform.readyState).toBe(0);
    expect(connections.tenantShared.readyState).toBe(0);
  });
});

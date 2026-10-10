import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogCapture, type LogCapture } from "../../test-support/log-capture.js";
import { createLogger } from "../logger/index.js";
import { registerShutdown } from "./shutdown.js";

function hasEvent(logs: LogCapture, event: string): boolean {
  return logs.lines().some((line) => line["event"] === event);
}

describe("registerShutdown", () => {
  let removeListeners: () => void = () => undefined;
  let logs = createLogCapture();

  beforeEach(() => {
    logs = createLogCapture();
    process.exitCode = undefined;
  });

  afterEach(() => {
    removeListeners();
    vi.useRealTimers();
    process.exitCode = undefined;
  });

  it("runs the tasks in order on SIGTERM and exits with code 0", async () => {
    const order: string[] = [];
    removeListeners = registerShutdown({
      logger: createLogger({ level: "info", destination: logs.destination }),
      tasks: [
        { name: "first", run: async () => void order.push("first") },
        { name: "second", run: async () => void order.push("second") },
      ],
    });

    process.emit("SIGTERM");
    await vi.waitFor(() => expect(hasEvent(logs, "shutdown.completed")).toBe(true));

    expect(order).toEqual(["first", "second"]);
    expect(process.exitCode).toBe(0);
  });

  it("sets exit code 1 and calls onTimeout when a task exceeds the timeout", async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const exit = vi.fn();
    removeListeners = registerShutdown({
      logger: createLogger({ level: "info", destination: logs.destination }),
      tasks: [{ name: "hangs", run: () => new Promise<void>(() => undefined) }],
      timeoutMs: 1000,
      onTimeout,
      exit,
    });

    process.emit("SIGINT");
    await vi.advanceTimersByTimeAsync(1000);

    expect(onTimeout).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(1);
    expect(process.exitCode).toBe(1);
    expect(hasEvent(logs, "shutdown.timeout")).toBe(true);
  });

  it("forces exit 1 on a second signal", () => {
    const exit = vi.fn();
    removeListeners = registerShutdown({
      logger: createLogger({ level: "info", destination: logs.destination }),
      tasks: [{ name: "hangs", run: () => new Promise<void>(() => undefined) }],
      exit,
    });

    process.emit("SIGTERM");
    process.emit("SIGTERM");

    expect(exit).toHaveBeenCalledWith(1);
  });

  it("keeps running later tasks and exits 1 when a task fails", async () => {
    const laterTask = vi.fn(async () => undefined);
    removeListeners = registerShutdown({
      logger: createLogger({ level: "info", destination: logs.destination }),
      tasks: [
        { name: "fails", run: () => Promise.reject(new Error("boom")) },
        { name: "later", run: laterTask },
      ],
    });

    process.emit("SIGTERM");
    await vi.waitFor(() => expect(hasEvent(logs, "shutdown.completed")).toBe(true));

    expect(laterTask).toHaveBeenCalledOnce();
    expect(process.exitCode).toBe(1);
  });
});

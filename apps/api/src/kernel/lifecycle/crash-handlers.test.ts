import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LogCapture } from "../../test-support/log-capture.js";
import { installTestLogger } from "../../test-support/test-databases.js";
import { registerCrashHandlers } from "./crash-handlers.js";

describe("registerCrashHandlers", () => {
  let logs: LogCapture;
  let removeHandlers: () => void = () => undefined;
  const runnerRejectionListeners = process.listeners("unhandledRejection");
  const runnerExceptionListeners = process.listeners("uncaughtException");

  beforeEach(() => {
    logs = installTestLogger();
    // The test runner has its own crash listeners; detach them so an emitted event cannot fail the run.
    process.removeAllListeners("unhandledRejection");
    process.removeAllListeners("uncaughtException");
  });

  afterEach(() => {
    removeHandlers();
    for (const listener of runnerRejectionListeners) process.on("unhandledRejection", listener);
    for (const listener of runnerExceptionListeners) process.on("uncaughtException", listener);
  });

  function expectReportedAndExited(exit: ReturnType<typeof vi.fn>): void {
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    const errorLine = logs.lines().find((line) => line["msg"] === "unhandled error");
    expect(errorLine?.["err"]).toMatchObject({ message: "crashed outside a request" });
  }

  it("reports an unhandled rejection through the logger and exits 1", () => {
    const exit = vi.fn();
    removeHandlers = registerCrashHandlers({ exit });

    process.emit(
      "unhandledRejection",
      new Error("crashed outside a request"),
      Promise.resolve(undefined),
    );

    expectReportedAndExited(exit);
  });

  it("reports an uncaught exception through the logger and exits 1", () => {
    const exit = vi.fn();
    removeHandlers = registerCrashHandlers({ exit });

    process.emit("uncaughtException", new Error("crashed outside a request"));

    expectReportedAndExited(exit);
  });

  it("stops handling events after the returned function is called", () => {
    const exit = vi.fn();
    registerCrashHandlers({ exit })();

    expect(process.listenerCount("uncaughtException")).toBe(0);
    expect(process.listenerCount("unhandledRejection")).toBe(0);
    expect(exit).not.toHaveBeenCalled();
  });
});

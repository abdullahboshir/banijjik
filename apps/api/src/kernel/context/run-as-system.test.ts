import { SYSTEM_REASON } from "@banijjik/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { installTestLogger } from "../../test-support/test-databases.js";
import type { LogCapture } from "../../test-support/log-capture.js";
import { findRequestContext, runAsSystem, runWithRequestContext } from "./index.js";

let logs: LogCapture;

beforeEach(() => {
  logs = installTestLogger();
});

function systemAccessLines(): Record<string, unknown>[] {
  return logs.lines().filter((line) => line["event"] === "system_access");
}

describe("runAsSystem", () => {
  it("runs the work in a context that carries the reason and keeps the request data", async () => {
    const outer = { requestId: "request-1", organizationId: "org-1" };

    const inside = await runWithRequestContext(outer, () =>
      runAsSystem(SYSTEM_REASON.AUTH_LOOKUP, async () => findRequestContext()),
    );

    expect(inside).toEqual({ ...outer, systemReason: "AUTH_LOOKUP" });
  });

  it("leaves the outer context unchanged afterwards", async () => {
    const outer = { requestId: "request-2" };

    await runWithRequestContext(outer, async () => {
      await runAsSystem(SYSTEM_REASON.SEED, async () => undefined);
      expect(findRequestContext()).toEqual(outer);
      expect(findRequestContext()).not.toHaveProperty("systemReason");
    });
  });

  it("logs one system_access line with the reason and the request id", async () => {
    await runWithRequestContext({ requestId: "request-3" }, () =>
      runAsSystem(SYSTEM_REASON.WEBHOOK_ROUTING, async () => undefined),
    );

    const lines = systemAccessLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: 30,
      reason: "WEBHOOK_ROUTING",
      requestId: "request-3",
    });
  });

  it("creates its own request id when called outside a request", async () => {
    const inside = await runAsSystem(SYSTEM_REASON.SCHEDULED_JOB, async () => findRequestContext());

    expect(inside?.systemReason).toBe("SCHEDULED_JOB");
    expect(inside?.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(findRequestContext()).toBeUndefined();
    expect(systemAccessLines()[0]?.["requestId"]).toBe(inside?.requestId);
  });

  it("returns the value of the work and passes its error through", async () => {
    expect(await runAsSystem(SYSTEM_REASON.MIGRATION, async () => 42)).toBe(42);

    await expect(
      runAsSystem(SYSTEM_REASON.MIGRATION, async () => {
        throw new Error("failed inside");
      }),
    ).rejects.toThrow("failed inside");
  });
});

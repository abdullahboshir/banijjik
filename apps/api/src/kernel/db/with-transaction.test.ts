import { newId } from "@banijjik/ids";
import type { ClientSession } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { LogCapture } from "../../test-support/log-capture.js";
import {
  PLATFORM_PROBE,
  registerProbeModels,
  TENANT_PROBE,
  type ProbeDocument,
} from "../../test-support/probe-models.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../test-support/test-databases.js";
import { AppError } from "../http/app-error.js";
import type { DatabaseConnections } from "./database-connections.js";
import { initializeModels, models } from "./models.js";
import { getActiveSession, onCommitted, withTransaction } from "./with-transaction.js";

registerProbeModels();

let connections: DatabaseConnections;
let logs: LogCapture;

beforeAll(async () => {
  logs = installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

beforeEach(async () => {
  await models({}).get(PLATFORM_PROBE).deleteMany({});
  await models({}).get(TENANT_PROBE).deleteMany({});
});

async function insertInBothDatabases(session: ClientSession): Promise<void> {
  const platform = models({}).get<ProbeDocument>(PLATFORM_PROBE);
  const tenant = models({}).get<ProbeDocument>(TENANT_PROBE);
  await platform.create([{ probeId: newId(), label: "platform" }], { session });
  await tenant.create([{ probeId: newId(), label: "tenant" }], { session });
}

async function countDocuments(): Promise<{ platform: number; tenant: number }> {
  return {
    platform: await models({}).get(PLATFORM_PROBE).countDocuments(),
    tenant: await models({}).get(TENANT_PROBE).countDocuments(),
  };
}

function transientError(): Error {
  return Object.assign(new Error("simulated write conflict"), {
    errorLabels: ["TransientTransactionError"],
  });
}

describe("withTransaction", () => {
  it("rolls back a platform write and a tenant write together when the work throws", async () => {
    await expect(
      withTransaction(async (session) => {
        await insertInBothDatabases(session);
        throw new Error("intentional abort");
      }),
    ).rejects.toThrow("intentional abort");

    expect(await countDocuments()).toEqual({ platform: 0, tenant: 0 });
  });

  it("commits writes to both databases when the work succeeds", async () => {
    const result = await withTransaction(async (session) => {
      await insertInBothDatabases(session);
      return "done";
    });

    expect(result).toBe("done");
    expect(await countDocuments()).toEqual({ platform: 1, tenant: 1 });
  });

  it("reuses the outer session in a nested call", async () => {
    const sessionIds: unknown[] = [];

    await withTransaction(async (outer) => {
      sessionIds.push(outer.id);
      await withTransaction(async (inner) => {
        sessionIds.push(inner.id);
        sessionIds.push(getActiveSession()?.id);
      });
    });

    expect(sessionIds[1]).toEqual(sessionIds[0]);
    expect(sessionIds[2]).toEqual(sessionIds[0]);
  });

  it("rolls the outer writes back when a nested call throws", async () => {
    await expect(
      withTransaction(async (outer) => {
        await insertInBothDatabases(outer);
        await withTransaction(async () => {
          throw new Error("inner abort");
        });
      }),
    ).rejects.toThrow("inner abort");

    expect(await countDocuments()).toEqual({ platform: 0, tenant: 0 });
  });

  it("retries an error labelled TransientTransactionError and returns the third attempt's result", async () => {
    let attempts = 0;

    const result = await withTransaction(async (session) => {
      attempts += 1;
      if (attempts <= 2) throw transientError();
      await insertInBothDatabases(session);
      return attempts;
    });

    expect(result).toBe(3);
    expect(attempts).toBe(3);
    expect(await countDocuments()).toEqual({ platform: 1, tenant: 1 });
  });

  it("gives up after maxAttempts and rethrows the transient error", async () => {
    let attempts = 0;

    await expect(
      withTransaction(
        async () => {
          attempts += 1;
          throw transientError();
        },
        { maxAttempts: 2 },
      ),
    ).rejects.toThrow("simulated write conflict");

    expect(attempts).toBe(2);
  });

  it("does not retry an error without the transient label", async () => {
    let attempts = 0;

    await expect(
      withTransaction(async () => {
        attempts += 1;
        throw new Error("plain failure");
      }),
    ).rejects.toThrow("plain failure");

    expect(attempts).toBe(1);
  });

  it("detects a real write conflict between two transactions and retries the loser", async () => {
    const platform = models({}).get<ProbeDocument>(PLATFORM_PROBE);
    const probeId = newId();
    await platform.create({ probeId, label: "0" });
    let attempts = 0;
    const bump = (): Promise<void> =>
      withTransaction(async (session) => {
        attempts += 1;
        await platform.updateOne({ probeId }, { $inc: { version: 1 } }, { session });
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

    await Promise.all([bump(), bump()]);

    const stored = await platform.findOne({ probeId }).lean<ProbeDocument>();
    expect(stored?.version).toBe(3);
    expect(attempts).toBeGreaterThanOrEqual(3);
  });
});

describe("getActiveSession", () => {
  it("is undefined outside a transaction and set inside one", async () => {
    expect(getActiveSession()).toBeUndefined();

    await withTransaction(async (session) => {
      expect(getActiveSession()).toBe(session);
    });

    expect(getActiveSession()).toBeUndefined();
  });
});

describe("onCommitted", () => {
  it("runs the callbacks once, in order, only after the commit", async () => {
    const events: string[] = [];

    await withTransaction(async (session) => {
      onCommitted(async () => void events.push(`first:${String(session.inTransaction())}`));
      onCommitted(async () => void events.push("second"));
      events.push("work");
    });

    expect(events).toEqual(["work", "first:false", "second"]);
  });

  it("does not run the callbacks when the transaction aborts", async () => {
    let called = false;

    await expect(
      withTransaction(async () => {
        onCommitted(async () => {
          called = true;
        });
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");

    expect(called).toBe(false);
  });

  it("drops callbacks registered by an attempt that was retried", async () => {
    let attempts = 0;
    let calls = 0;

    await withTransaction(async () => {
      attempts += 1;
      onCommitted(async () => void (calls += 1));
      if (attempts === 1) throw transientError();
    });

    expect(calls).toBe(1);
  });

  it("reports a failing callback, keeps the result and still runs the next callback", async () => {
    let secondRan = false;

    const result = await withTransaction(async () => {
      onCommitted(async () => {
        throw new Error("cache invalidation failed");
      });
      onCommitted(async () => {
        secondRan = true;
      });
      return "committed";
    });

    expect(result).toBe("committed");
    expect(secondRan).toBe(true);
    expect(logs.text()).toContain("cache invalidation failed");
  });

  it("throws outside a transaction instead of running silently", () => {
    const register = (): void => onCommitted(async () => undefined);

    expect(register).toThrow(AppError);
    expect(register).toThrow(/errors\.no_active_transaction/);
  });
});

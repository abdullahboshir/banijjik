import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
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
import { updateVersioned } from "./versioned-update.js";
import { withTransaction } from "./with-transaction.js";

registerProbeModels();

let connections: DatabaseConnections;

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

async function createProbe(label: string): Promise<string> {
  const probeId = newId();
  await models({}).get<ProbeDocument>(TENANT_PROBE).create({ probeId, label });
  return probeId;
}

async function captureError(attempt: Promise<unknown>): Promise<AppError> {
  try {
    await attempt;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

describe("updateVersioned", () => {
  it("rejects a value outside the schema enum instead of writing it (M5)", async () => {
    const probeId = await createProbe("enum");
    const model = models({}).get<ProbeDocument>(TENANT_PROBE);

    await expect(
      updateVersioned({
        model,
        filter: { probeId },
        expectedVersion: 1,
        update: { $set: { kind: "NOT_A_KIND" } },
      }),
    ).rejects.toThrow(/kind/);

    const stored = await model.findOne({ probeId }).lean<ProbeDocument>();
    expect(stored?.kind).toBeUndefined();
    expect(stored?.version).toBe(1);
  });

  it("applies the update, bumps the version and returns the document without _id", async () => {
    const probeId = await createProbe("before");
    const model = models({}).get<ProbeDocument>(TENANT_PROBE);

    const updated = await updateVersioned({
      model,
      filter: { probeId },
      expectedVersion: 1,
      update: { $set: { label: "after" } },
    });

    expect(updated).toMatchObject({ probeId, label: "after", version: 2 });
    expect(updated).not.toHaveProperty("_id");
  });

  it("answers 409 CONFLICT with the current version when the version is stale", async () => {
    const probeId = await createProbe("before");
    const model = models({}).get<ProbeDocument>(TENANT_PROBE);
    await updateVersioned({
      model,
      filter: { probeId },
      expectedVersion: 1,
      update: { $set: { label: "a" } },
    });

    const error = await captureError(
      updateVersioned({
        model,
        filter: { probeId },
        expectedVersion: 1,
        update: { $set: { label: "b" } },
      }),
    );

    expect(error.code).toBe("CONFLICT");
    expect(error.httpStatus).toBe(409);
    expect(error.details).toEqual({ currentVersion: 2 });
    const stored = await model.findOne({ probeId }).lean();
    expect(stored?.label).toBe("a");
  });

  it("answers 404 NOT_FOUND for an unknown id", async () => {
    const model = models({}).get<ProbeDocument>(TENANT_PROBE);

    const error = await captureError(
      updateVersioned({
        model,
        filter: { probeId: newId() },
        expectedVersion: 1,
        update: { $set: { label: "x" } },
      }),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(error.httpStatus).toBe(404);
  });

  it("lets exactly one of two concurrent writers with the same version win", async () => {
    const probeId = await createProbe("race");
    const model = models({}).get<ProbeDocument>(TENANT_PROBE);
    const write = (label: string): Promise<unknown> =>
      updateVersioned({
        model,
        filter: { probeId },
        expectedVersion: 1,
        update: { $set: { label } },
      });

    const outcomes = await Promise.allSettled([write("one"), write("two")]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
  });

  it("joins the surrounding transaction and rolls back with it", async () => {
    const probeId = await createProbe("tx");
    const model = models({}).get<ProbeDocument>(TENANT_PROBE);

    await expect(
      withTransaction(async () => {
        await updateVersioned({
          model,
          filter: { probeId },
          expectedVersion: 1,
          update: { $set: { label: "gone" } },
        });
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");

    const stored = await model.findOne({ probeId }).lean();
    expect(stored).toMatchObject({ label: "tx", version: 1 });
  });
});

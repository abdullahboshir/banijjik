import { SYSTEM_REASON } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  APPEND_ONLY_PROBE,
  registerAppendOnlyProbeModel,
  type ProbeDocument,
} from "../../test-support/probe-models.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../test-support/test-databases.js";
import { runAsSystem } from "../context/index.js";
import type { DatabaseConnections } from "./database-connections.js";
import { initializeModels, models } from "./models.js";

registerAppendOnlyProbeModel();

let connections: DatabaseConnections;

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

function probes() {
  return models({}).get<ProbeDocument>(APPEND_ONLY_PROBE);
}

async function insertProbe(label: string): Promise<string> {
  const probeId = newId();
  await probes().create({ probeId, label });
  return probeId;
}

const APPEND_ONLY_ERROR = { messageKey: "errors.append_only_model" };

describe("an append-only model", () => {
  it("accepts inserts, one by one and in bulk", async () => {
    await insertProbe("single");
    await probes().insertMany([
      { probeId: newId(), label: "first of two" },
      { probeId: newId(), label: "second of two" },
    ]);

    expect(await probes().countDocuments({ label: /of two$/ })).toBe(2);
  });

  it("refuses updateOne and updateMany", async () => {
    const probeId = await insertProbe("keep");

    await expect(
      probes().updateOne({ probeId }, { $set: { label: "changed" } }),
    ).rejects.toMatchObject(APPEND_ONLY_ERROR);
    await expect(probes().updateMany({}, { $set: { label: "changed" } })).rejects.toMatchObject(
      APPEND_ONLY_ERROR,
    );
  });

  it("refuses findOneAndUpdate, replaceOne and findOneAndReplace", async () => {
    const probeId = await insertProbe("keep");

    await expect(
      probes().findOneAndUpdate({ probeId }, { $set: { label: "changed" } }),
    ).rejects.toMatchObject(APPEND_ONLY_ERROR);
    await expect(
      probes().replaceOne({ probeId }, { probeId, label: "replaced", version: 1 }),
    ).rejects.toMatchObject(APPEND_ONLY_ERROR);
    await expect(
      probes().findOneAndReplace({ probeId }, { probeId, label: "replaced", version: 1 }),
    ).rejects.toMatchObject(APPEND_ONLY_ERROR);
  });

  it("refuses deleteOne, deleteMany and findOneAndDelete", async () => {
    const probeId = await insertProbe("keep");

    await expect(probes().deleteOne({ probeId })).rejects.toMatchObject(APPEND_ONLY_ERROR);
    await expect(probes().deleteMany({})).rejects.toMatchObject(APPEND_ONLY_ERROR);
    await expect(probes().findOneAndDelete({ probeId })).rejects.toMatchObject(APPEND_ONLY_ERROR);
    expect(await probes().countDocuments({ probeId })).toBe(1);
  });

  it("refuses a bulkWrite update and delete, and allows a bulkWrite of inserts only", async () => {
    const probeId = await insertProbe("keep");

    await expect(
      probes().bulkWrite([
        { updateOne: { filter: { probeId }, update: { $set: { label: "x" } } } },
      ]),
    ).rejects.toMatchObject(APPEND_ONLY_ERROR);
    await expect(
      probes().bulkWrite([{ deleteOne: { filter: { probeId } } }]),
    ).rejects.toMatchObject(APPEND_ONLY_ERROR);
    await probes().bulkWrite([
      { insertOne: { document: { probeId: newId(), label: "bulk insert", version: 1 } } },
    ]);

    expect(await probes().countDocuments({ label: "bulk insert" })).toBe(1);
  });

  it("refuses save() of a document that was loaded, and delete through the document", async () => {
    const probeId = await insertProbe("keep");
    const loaded = await probes().findOne({ probeId });
    if (loaded === null) throw new Error("probe missing");

    loaded.label = "edited";
    await expect(loaded.save()).rejects.toMatchObject(APPEND_ONLY_ERROR);
    await expect(loaded.deleteOne()).rejects.toMatchObject(APPEND_ONLY_ERROR);
    expect(await probes().countDocuments({ probeId, label: "keep" })).toBe(1);
  });

  it("is not unlocked by an ordinary system reason, only by MIGRATION", async () => {
    const probeId = await insertProbe("retention candidate");

    await expect(
      runAsSystem(SYSTEM_REASON.SEED, () => probes().deleteMany({ probeId })),
    ).rejects.toMatchObject(APPEND_ONLY_ERROR);
    await runAsSystem(SYSTEM_REASON.MIGRATION, () => probes().deleteMany({ probeId }));

    expect(await probes().countDocuments({ probeId })).toBe(0);
  });
});

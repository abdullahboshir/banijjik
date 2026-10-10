import { DATABASE_KIND, MODEL_TENANCY, SYSTEM_REASON } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { Schema } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LogCapture } from "../../test-support/log-capture.js";
import { withOrganizationContext } from "../../test-support/organization-context.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../test-support/test-databases.js";
import { runAsSystem } from "../context/index.js";
import {
  auditFields,
  domainIdField,
  initializeModels,
  models,
  registerModel,
  SCHEMA_OPTIONS,
  type DatabaseConnections,
} from "../db/index.js";

const MODEL_NAME = "PluginThing";

interface ThingDocument {
  thingId: string;
  /** Optional for callers: the plugin stamps it. */
  organizationId?: string;
  label: string;
  rank?: number;
}

const thingSchema = new Schema(
  {
    ...domainIdField("thingId"),
    organizationId: { type: String, required: true, immutable: true },
    label: { type: String, required: true },
    rank: { type: Number },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);
thingSchema.index({ organizationId: 1, thingId: 1 }, { unique: true });

registerModel({
  modelName: MODEL_NAME,
  collectionName: "plugin_things",
  database: DATABASE_KIND.TENANT,
  schema: thingSchema,
  tenancy: MODEL_TENANCY.ORGANIZATION,
});

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

function things() {
  return models({}).get<ThingDocument>(MODEL_NAME);
}

interface World {
  readonly a: string;
  readonly b: string;
  readonly inA: <Result>(work: () => Promise<Result>) => Promise<Result>;
  readonly inB: <Result>(work: () => Promise<Result>) => Promise<Result>;
  readonly firstOfB: string;
  readonly secondOfB: string;
}

/** Two organizations with two rows each, written as system so the test controls both. */
async function aWorld(): Promise<World> {
  const a = newId();
  const b = newId();
  const firstOfB = newId();
  const secondOfB = newId();
  await runAsSystem(SYSTEM_REASON.SEED, async () => {
    await things().create([
      { thingId: newId(), organizationId: a, label: "a-one", rank: 1 },
      { thingId: newId(), organizationId: a, label: "a-two", rank: 2 },
      { thingId: firstOfB, organizationId: b, label: "b-one", rank: 1 },
      { thingId: secondOfB, organizationId: b, label: "b-two", rank: 2 },
    ]);
  });
  return {
    a,
    b,
    firstOfB,
    secondOfB,
    inA: (work) => withOrganizationContext(a, work),
    inB: (work) => withOrganizationContext(b, work),
  };
}

function countOfB(world: World): Promise<number> {
  return world.inB(() => things().countDocuments());
}

describe("tenant plugin: reads", () => {
  it("find sees only the rows of the active organization", async () => {
    const world = await aWorld();
    const rows = await world.inA(() => things().find().lean());
    expect(rows.map((row) => row.label).sort()).toEqual(["a-one", "a-two"]);
  });

  it("findOne never returns a row of another organization", async () => {
    const world = await aWorld();
    const row = await world.inA(() => things().findOne({ label: "b-one" }).lean());
    expect(row).toBeNull();
  });

  it("countDocuments counts only the active organization", async () => {
    const world = await aWorld();
    expect(await world.inA(() => things().countDocuments())).toBe(2);
  });

  it("distinct looks only at the active organization", async () => {
    const world = await aWorld();
    const labels = await world.inA(() => things().distinct("label"));
    expect(labels.sort()).toEqual(["a-one", "a-two"]);
  });

  it("aggregate starts with the organization filter", async () => {
    const world = await aWorld();
    const result = await world.inA(() =>
      things().aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: "$rank" } } }]),
    );
    expect(result).toEqual([{ _id: null, total: 3 }]);
  });
});

describe("tenant plugin: writes against rows of another organization match nothing", () => {
  it("updateOne", async () => {
    const world = await aWorld();
    const result = await world.inA(() =>
      things().updateOne({ thingId: world.firstOfB }, { $set: { label: "hacked" } }),
    );
    expect(result.matchedCount).toBe(0);
    expect(await countOfB(world)).toBe(2);
  });

  it("updateMany", async () => {
    const world = await aWorld();
    const result = await world.inA(() => things().updateMany({ rank: 1 }, { $set: { rank: 9 } }));
    expect(result.matchedCount).toBe(1);
    const untouched = await world.inB(() => things().countDocuments({ rank: 1 }));
    expect(untouched).toBe(1);
  });

  it("deleteOne", async () => {
    const world = await aWorld();
    const result = await world.inA(() => things().deleteOne({ thingId: world.firstOfB }));
    expect(result.deletedCount).toBe(0);
    expect(await countOfB(world)).toBe(2);
  });

  it("deleteMany", async () => {
    const world = await aWorld();
    const result = await world.inA(() => things().deleteMany({}));
    expect(result.deletedCount).toBe(2);
    expect(await countOfB(world)).toBe(2);
  });

  it("findOneAndUpdate", async () => {
    const world = await aWorld();
    const found = await world.inA(() =>
      things().findOneAndUpdate({ thingId: world.firstOfB }, { $set: { label: "hacked" } }),
    );
    expect(found).toBeNull();
  });

  it("findOneAndDelete", async () => {
    const world = await aWorld();
    const found = await world.inA(() => things().findOneAndDelete({ thingId: world.firstOfB }));
    expect(found).toBeNull();
    expect(await countOfB(world)).toBe(2);
  });

  it("findOneAndReplace", async () => {
    const world = await aWorld();
    const found = await world.inA(() =>
      things().findOneAndReplace({ thingId: world.firstOfB }, { thingId: newId(), label: "x" }),
    );
    expect(found).toBeNull();
  });

  it("replaceOne matches nothing of another organization and stamps the replacement of its own", async () => {
    const world = await aWorld();
    const foreign = await world.inA(() =>
      things().replaceOne({ thingId: world.firstOfB }, { thingId: newId(), label: "x" }),
    );
    expect(foreign.matchedCount).toBe(0);
    const own = await world.inA(() =>
      things().replaceOne({ label: "a-one" }, { thingId: newId(), label: "replaced" }),
    );
    expect(own.modifiedCount).toBe(1);
    const stored = await world.inA(() => things().findOne({ label: "replaced" }).lean());
    expect(stored?.organizationId).toBe(world.a);
  });
});

describe("tenant plugin: inserts", () => {
  it("save with another organization throws errors.cross_organization_access", async () => {
    const world = await aWorld();
    const attempt = world.inA(() =>
      things().create({ thingId: newId(), organizationId: world.b, label: "x" }),
    );
    await expect(attempt).rejects.toThrow(/errors\.cross_organization_access/);
  });

  it("save without an organization stamps the active one", async () => {
    const world = await aWorld();
    const created = await world.inA(() => things().create({ thingId: newId(), label: "stamped" }));
    expect(created.organizationId).toBe(world.a);
  });

  it("insertMany stamps missing organizations and refuses another one", async () => {
    const world = await aWorld();
    await world.inA(() => things().insertMany([{ thingId: newId(), label: "m1" }]));
    const stamped = await world.inA(() => things().findOne({ label: "m1" }).lean());
    expect(stamped?.organizationId).toBe(world.a);
    const attempt = world.inA(() =>
      things().insertMany([{ thingId: newId(), organizationId: world.b, label: "m2" }]),
    );
    await expect(attempt).rejects.toThrow(/errors\.cross_organization_access/);
  });
});

describe("tenant plugin: bulkWrite", () => {
  it("applies the same rules to every operation in a mixed batch", async () => {
    const world = await aWorld();
    const result = await world.inA(() =>
      things().bulkWrite([
        { insertOne: { document: { thingId: String(newId()), label: "bulk-new" } } },
        { updateOne: { filter: { thingId: world.firstOfB }, update: { $set: { label: "x" } } } },
        { updateMany: { filter: { rank: 1 }, update: { $set: { rank: 5 } } } },
        { deleteOne: { filter: { thingId: world.secondOfB } } },
      ]),
    );
    expect(result.insertedCount).toBe(1);
    expect(result.matchedCount).toBe(1);
    expect(result.deletedCount).toBe(0);
    expect(await countOfB(world)).toBe(2);
    const stamped = await world.inA(() => things().findOne({ label: "bulk-new" }).lean());
    expect(stamped?.organizationId).toBe(world.a);
  });

  it("refuses an insert for another organization and matches nothing when replacing a foreign row", async () => {
    const world = await aWorld();
    const insert = world.inA(() =>
      things().bulkWrite([
        { insertOne: { document: { thingId: newId(), organizationId: world.b, label: "x" } } },
      ]),
    );
    await expect(insert).rejects.toThrow(/errors\.cross_organization_access/);
    const replaced = await world.inA(() =>
      things().bulkWrite([
        {
          replaceOne: {
            filter: { thingId: world.firstOfB },
            replacement: { thingId: newId(), label: "x" },
          },
        },
      ]),
    );
    expect(replaced.matchedCount).toBe(0);
  });

  it("refuses an update that sets organizationId", async () => {
    const world = await aWorld();
    const setting = world.inA(() =>
      things().bulkWrite([
        {
          updateOne: { filter: { label: "a-one" }, update: { $set: { organizationId: world.b } } },
        },
      ]),
    );
    await expect(setting).rejects.toThrow(/errors\.cross_organization_access/);
  });
});

describe("tenant plugin: refusals", () => {
  it("a filter naming another organization throws", async () => {
    const world = await aWorld();
    const attempt = world.inA(() => things().find({ organizationId: world.b }));
    await expect(attempt).rejects.toThrow(/errors\.cross_organization_access/);
  });

  it("a filter naming the active organization is fine", async () => {
    const world = await aWorld();
    const rows = await world.inA(() => things().find({ organizationId: world.a }).lean());
    expect(rows).toHaveLength(2);
  });

  it("$set on organizationId throws", async () => {
    const world = await aWorld();
    const attempt = world.inA(() =>
      things().updateOne({ label: "a-one" }, { $set: { organizationId: world.b } }),
    );
    await expect(attempt).rejects.toThrow(/errors\.cross_organization_access/);
  });

  it("$unset on organizationId throws", async () => {
    const world = await aWorld();
    const attempt = world.inA(() =>
      // Cast: the typed update API hides $unset of a required path; the plugin must still refuse it.
      things().updateMany({}, { $unset: { organizationId: "" } } as never),
    );
    await expect(attempt).rejects.toThrow(/errors\.cross_organization_access/);
  });

  it("a pipeline update throws errors.unsafe_tenant_update", async () => {
    const world = await aWorld();
    const attempt = world.inA(() =>
      things().updateOne({}, [{ $set: { label: "x" } }], { updatePipeline: true }),
    );
    await expect(attempt).rejects.toThrow(/errors\.unsafe_tenant_update/);
  });

  it("estimatedDocumentCount throws errors.unsafe_tenant_count", async () => {
    const world = await aWorld();
    const attempt = world.inA(() => things().estimatedDocumentCount());
    await expect(attempt).rejects.toThrow(/errors\.unsafe_tenant_count/);
  });

  it("an aggregate with $lookup throws errors.unsafe_tenant_aggregate, also inside $facet", async () => {
    const world = await aWorld();
    const lookup = { $lookup: { from: "plugin_things", as: "all", pipeline: [] } };
    await expect(world.inA(() => things().aggregate([lookup]))).rejects.toThrow(
      /errors\.unsafe_tenant_aggregate/,
    );
    await expect(
      world.inA(() => things().aggregate([{ $facet: { everything: [lookup] } }])),
    ).rejects.toThrow(/errors\.unsafe_tenant_aggregate/);
  });
});

describe("tenant plugin: context", () => {
  it("throws errors.missing_tenant_context without a request context", async () => {
    await expect(things().find()).rejects.toThrow(/errors\.missing_tenant_context/);
    await expect(things().create({ thingId: newId(), label: "x" })).rejects.toThrow(
      /errors\.missing_tenant_context/,
    );
  });

  it("runAsSystem sees both organizations and leaves one system_access log line", async () => {
    const world = await aWorld();
    const before = logs.lines().filter((line) => line["event"] === "system_access").length;
    const rows = await runAsSystem(SYSTEM_REASON.MIGRATION, () =>
      things()
        .find({ organizationId: { $in: [world.a, world.b] } })
        .lean(),
    );
    expect(rows).toHaveLength(4);
    const after = logs.lines().filter((line) => line["event"] === "system_access");
    expect(after.length - before).toBe(1);
    expect(after.at(-1)).toMatchObject({ reason: "MIGRATION" });
  });
});

describe("tenant plugin: document-level writes on a document of another organization", () => {
  async function foreignDocument(world: World) {
    const found = await runAsSystem(SYSTEM_REASON.MIGRATION, () =>
      things().findOne({ thingId: world.firstOfB }),
    );
    if (found === null) throw new Error("the foreign row should exist");
    return found;
  }

  it("doc.deleteOne() matches nothing and leaves the row intact", async () => {
    const world = await aWorld();
    const document = await foreignDocument(world);

    const result = await world.inA(() => document.deleteOne());

    expect(result.deletedCount).toBe(0);
    expect(await countOfB(world)).toBe(2);
  });

  it("doc.updateOne() matches nothing and leaves the row intact", async () => {
    const world = await aWorld();
    const document = await foreignDocument(world);

    const result = await world.inA(() => document.updateOne({ $set: { label: "x" } }));

    expect(result.matchedCount).toBe(0);
    const stored = await world.inB(() => things().findOne({ thingId: world.firstOfB }).lean());
    expect(stored?.label).toBe("b-one");
  });

  it("doc.save() after changing a field throws errors.cross_organization_access", async () => {
    const world = await aWorld();
    const document = await foreignDocument(world);
    document.label = "changed";

    await expect(world.inA(() => document.save())).rejects.toThrow(
      /errors\.cross_organization_access/,
    );
    const stored = await world.inB(() => things().findOne({ thingId: world.firstOfB }).lean());
    expect(stored?.label).toBe("b-one");
  });
});

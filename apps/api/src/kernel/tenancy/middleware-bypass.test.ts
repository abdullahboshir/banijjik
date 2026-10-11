import { LOCATION_STATUS, LOCATION_TYPE, MODEL_TENANCY, SYSTEM_REASON } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { Aggregate, Query, type Model } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIamApiModels } from "../../test-support/iam-api-harness.js";
import { withOrganizationContext } from "../../test-support/organization-context.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../test-support/test-databases.js";
import { runAsSystem } from "../context/index.js";
import { initializeModels, models, type DatabaseConnections } from "../db/index.js";
import { listModelDefinitions } from "../db/model-registry.js";

// Review finding J2 (probe P5): `middleware: false` must never switch the tenant filter or the
// append-only guard off. Mongoose 9.11 reads the option on queries, aggregates, cursors, model
// bulk calls and document calls; each spelling below is one of those paths.

registerIamApiModels();

const BYPASS_MESSAGE_KEY = "errors.middleware_bypass_forbidden";
// A pipeline that is not empty, so a bypassed aggregate is a real read and not a Mongoose usage error.
const MATCH_EVERYTHING = [{ $match: {} }];

type LooseDocument = Record<string, unknown>;
type LooseModel = Model<LooseDocument>;
type Spelling = (model: LooseModel, row: LooseDocument) => PromiseLike<unknown> | unknown;

interface BypassTarget {
  readonly modelName: string;
  readonly buildRow: (organizationId: string) => LooseDocument;
}

const TARGETS: readonly BypassTarget[] = [
  {
    modelName: "Location",
    buildRow: (organizationId) => ({
      locationId: newId(),
      organizationId,
      name: `place-${newId()}`,
      locationType: LOCATION_TYPE.STORE,
      isDefault: false,
      status: LOCATION_STATUS.ACTIVE,
    }),
  },
  {
    modelName: "AuditLog",
    buildRow: (organizationId) => ({
      auditLogId: newId(),
      organizationId,
      action: "CREATE",
      entityType: "LOCATION",
      entityId: newId(),
      changes: {},
      requestId: newId(),
      occurredAt: new Date(),
    }),
  },
];

const SPELLINGS: Readonly<Record<string, Spelling>> = {
  "find with options argument": (model) => model.find({}, null, { middleware: false }),
  "find then setOptions": (model) => model.find({}).setOptions({ middleware: false }),
  "find with only the pre hooks skipped": (model) =>
    model.find({}, null, { middleware: { pre: false } }),
  "findOne with options argument": (model) => model.findOne({}, null, { middleware: false }),
  "countDocuments with options argument": (model) =>
    model.countDocuments({}, { middleware: false }),
  "distinct then setOptions": (model) =>
    model.distinct("organizationId").setOptions({ middleware: false }),
  "updateMany with options argument": (model) =>
    model.updateMany({}, { $set: { updatedByUserId: null } }, { middleware: false }),
  "deleteMany with options argument": (model) => model.deleteMany({}, { middleware: false }),
  "query options object assigned directly": (model) => {
    const query = model.find({});
    query.getOptions().middleware = false;
    return query;
  },
  "query cursor with the option": (model) =>
    model.find({}).setOptions({ middleware: false }).cursor().next(),
  "aggregate with options argument": (model) =>
    model.aggregate(MATCH_EVERYTHING, { middleware: false }),
  "aggregate then option": (model) =>
    model.aggregate(MATCH_EVERYTHING).option({ middleware: false }),
  "aggregate options object assigned directly": (model) => {
    const pipeline = model.aggregate(MATCH_EVERYTHING);
    pipeline.options.middleware = false;
    return pipeline;
  },
  "aggregate cursor with the option": (model) =>
    model.aggregate(MATCH_EVERYTHING).option({ middleware: false }).cursor().next(),
  "insertMany with options argument": (model, row) =>
    model.insertMany([row], { middleware: false }),
  "create with options argument": (model, row) => model.create([row], { middleware: false }),
  "bulkWrite with options argument": (model, row) =>
    model.bulkWrite([{ insertOne: { document: row } }], { middleware: false }),
  "document save with options argument": (model, row) => new model(row).save({ middleware: false }),
  "document validate with options argument": (model, row) =>
    new model(row).validate(undefined, { middleware: false }),
  "document deleteOne with options argument": (model, row) =>
    new model(row).deleteOne({ middleware: false }),
};

let connections: DatabaseConnections;

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

function modelOf(modelName: string): LooseModel {
  return models({}).get<LooseDocument>(modelName);
}

async function seedTwoOrganizations(target: BypassTarget): Promise<{ a: string; b: string }> {
  const a = newId();
  const b = newId();
  await runAsSystem(SYSTEM_REASON.SEED, async () => {
    await modelOf(target.modelName).create([
      target.buildRow(a),
      target.buildRow(b),
      target.buildRow(b),
    ]);
  });
  return { a, b };
}

async function awaited(spelling: Spelling, model: LooseModel, row: LooseDocument): Promise<void> {
  await spelling(model, row);
}

describe.each(TARGETS)("middleware: false on $modelName (finding J2, probe P5)", (target) => {
  it("keeps a plain find filtered to the organization of the request", async () => {
    const world = await seedTwoOrganizations(target);

    const rows = await withOrganizationContext(world.a, () => modelOf(target.modelName).find({}));

    expect(rows).toHaveLength(1);
  });

  for (const [label, spelling] of Object.entries(SPELLINGS)) {
    it(`refuses ${label} in an organization context`, async () => {
      const world = await seedTwoOrganizations(target);

      const attempt = withOrganizationContext(world.a, () =>
        awaited(spelling, modelOf(target.modelName), target.buildRow(world.a)),
      );

      await expect(attempt).rejects.toMatchObject({ messageKey: BYPASS_MESSAGE_KEY });
    });
  }

  it("still lets runAsSystem(MIGRATION) pass the option", async () => {
    const world = await seedTwoOrganizations(target);

    const rows = await runAsSystem(SYSTEM_REASON.MIGRATION, () =>
      modelOf(target.modelName).find({ organizationId: world.b }, null, { middleware: false }),
    );

    expect(rows).toHaveLength(2);
  });

  it("does not let another system reason pass the option", async () => {
    const attempt = runAsSystem(SYSTEM_REASON.SEED, async () =>
      modelOf(target.modelName).find({}, null, { middleware: false }),
    );

    await expect(attempt).rejects.toMatchObject({ messageKey: BYPASS_MESSAGE_KEY });
  });
});

describe("middleware: false on every registered model (registry meta-test)", () => {
  const guarded = listModelDefinitions().filter(
    (definition) => definition.tenancy !== MODEL_TENANCY.NONE || definition.appendOnly === true,
  );

  it("covers the tenant models and the append-only models of the app", () => {
    expect(guarded.length).toBeGreaterThanOrEqual(8);
  });

  it("refuses the option on a query and on an aggregate of each of them", async () => {
    for (const definition of guarded) {
      const model = modelOf(definition.modelName);
      const query = withOrganizationContext(newId(), () =>
        awaited((candidate) => candidate.find({}, null, { middleware: false }), model, {}),
      );
      const pipeline = withOrganizationContext(newId(), () =>
        awaited(
          (candidate) => candidate.aggregate(MATCH_EVERYTHING, { middleware: false }),
          model,
          {},
        ),
      );

      await expect(query, definition.modelName).rejects.toMatchObject({
        messageKey: BYPASS_MESSAGE_KEY,
      });
      await expect(pipeline, definition.modelName).rejects.toMatchObject({
        messageKey: BYPASS_MESSAGE_KEY,
      });
    }
  });
});

// The wrappers above refuse the option. These tests go around them, through the base Mongoose
// prototypes the wrappers replace, to prove the hooks themselves ignore `middleware: false`
// (they carry Mongoose's built-in-middleware mark, see db/unskippable-hook.ts).
describe("the hooks themselves ignore middleware: false (second layer of finding J2)", () => {
  const location = TARGETS[0] as BypassTarget;
  const auditLog = TARGETS[1] as BypassTarget;

  it("keeps the tenant filter on a query that skips the wrapper", async () => {
    const world = await seedTwoOrganizations(location);

    const rows = await withOrganizationContext(world.a, async () => {
      const query = modelOf(location.modelName).find({});
      Query.prototype.setOptions.call(query, { middleware: false });
      return Query.prototype.exec.call(query);
    });

    expect(rows).toHaveLength(1);
  });

  it("keeps the tenant filter on an aggregate that skips the wrapper", async () => {
    const world = await seedTwoOrganizations(location);

    const rows = await withOrganizationContext(world.a, async () => {
      const pipeline = modelOf(location.modelName).aggregate(MATCH_EVERYTHING);
      Aggregate.prototype.option.call(pipeline, { middleware: false });
      return Aggregate.prototype.exec.call(pipeline);
    });

    expect(rows).toHaveLength(1);
  });

  it("keeps the tenant filter on an update that skips the wrapper", async () => {
    const world = await seedTwoOrganizations(location);

    const result = await withOrganizationContext(world.a, async () => {
      const query = modelOf(location.modelName).updateMany({}, { $set: { phoneE164: "+8801" } });
      Query.prototype.setOptions.call(query, { middleware: false });
      return Query.prototype.exec.call(query);
    });

    expect(result).toMatchObject({ matchedCount: 1, modifiedCount: 1 });
  });

  it("keeps the append-only guard on an update that skips the wrapper", async () => {
    const world = await seedTwoOrganizations(auditLog);

    const attempt = withOrganizationContext(world.a, async () => {
      const query = modelOf(auditLog.modelName).updateMany({}, { $set: { requestId: "x" } });
      Query.prototype.setOptions.call(query, { middleware: false });
      return Query.prototype.exec.call(query);
    });

    await expect(attempt).rejects.toMatchObject({ messageKey: "errors.append_only_model" });
  });

  it("keeps the tenant filter when the option is set after the query started", async () => {
    const world = await seedTwoOrganizations(location);

    const rows = await withOrganizationContext(world.a, async () => {
      const query = modelOf(location.modelName).find({});
      const running = Query.prototype.exec.call(query);
      query.getOptions().middleware = false;
      return running;
    });

    expect(rows).toHaveLength(1);
  });
});

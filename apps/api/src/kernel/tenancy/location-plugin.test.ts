import { DATABASE_KIND, MODEL_TENANCY, SYSTEM_REASON } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { Schema } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withOrganizationContext } from "../../test-support/organization-context.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../test-support/test-databases.js";
import { runAsSystem, runWithRequestContext } from "../context/index.js";
import {
  auditFields,
  domainIdField,
  initializeModels,
  models,
  registerModel,
  SCHEMA_OPTIONS,
  type DatabaseConnections,
} from "../db/index.js";

const MODEL_NAME = "PluginSite";

interface SiteDocument {
  siteId: string;
  organizationId: string;
  locationId: string;
  label: string;
}

const siteSchema = new Schema(
  {
    ...domainIdField("siteId"),
    organizationId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true },
    label: { type: String, required: true },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);
siteSchema.index({ organizationId: 1, locationId: 1 });

registerModel({
  modelName: MODEL_NAME,
  collectionName: "plugin_sites",
  database: DATABASE_KIND.TENANT,
  schema: siteSchema,
  tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
});

let connections: DatabaseConnections;

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

function sites() {
  return models({}).get<SiteDocument>(MODEL_NAME);
}

interface World {
  readonly organizationId: string;
  readonly locationOne: string;
  readonly locationTwo: string;
  readonly inLocationOne: <Result>(work: () => Promise<Result>) => Promise<Result>;
  readonly inAllLocations: <Result>(work: () => Promise<Result>) => Promise<Result>;
}

async function aWorld(): Promise<World> {
  const organizationId = newId();
  const locationOne = newId();
  const locationTwo = newId();
  await runAsSystem(SYSTEM_REASON.SEED, async () => {
    await sites().create([
      { siteId: newId(), organizationId, locationId: locationOne, label: "one" },
      { siteId: newId(), organizationId, locationId: locationTwo, label: "two" },
    ]);
  });
  return {
    organizationId,
    locationOne,
    locationTwo,
    inLocationOne: (work) =>
      withOrganizationContext(organizationId, work, { allowedLocationIds: [locationOne] }),
    inAllLocations: (work) => withOrganizationContext(organizationId, work),
  };
}

describe("location plugin", () => {
  it("lists only the rows of the allowed locations", async () => {
    const world = await aWorld();
    const rows = await world.inLocationOne(() => sites().find().lean());
    expect(rows.map((row) => row.label)).toEqual(["one"]);
  });

  it("a filter on a location outside the list finds no rows instead of failing", async () => {
    const world = await aWorld();
    const rows = await world.inLocationOne(() =>
      sites().find({ locationId: world.locationTwo }).lean(),
    );
    expect(rows).toEqual([]);
  });

  it("counts and aggregates only the allowed locations", async () => {
    const world = await aWorld();
    expect(await world.inLocationOne(() => sites().countDocuments())).toBe(1);
    const grouped = await world.inLocationOne(() =>
      sites().aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: 1 } } }]),
    );
    expect(grouped).toEqual([{ _id: null, total: 1 }]);
  });

  it("refuses to insert into a location outside the list with 403 LOCATION_FORBIDDEN", async () => {
    const world = await aWorld();
    const attempt = world.inLocationOne(() =>
      sites().create({ siteId: newId(), locationId: world.locationTwo, label: "x" }),
    );
    await expect(attempt).rejects.toMatchObject({ code: "LOCATION_FORBIDDEN", httpStatus: 403 });
  });

  it("refuses insertMany and bulk inserts into a location outside the list", async () => {
    const world = await aWorld();
    const many = world.inLocationOne(() =>
      sites().insertMany([{ siteId: newId(), locationId: world.locationTwo, label: "x" }]),
    );
    await expect(many).rejects.toMatchObject({ code: "LOCATION_FORBIDDEN" });
    const bulk = world.inLocationOne(() =>
      sites().bulkWrite([
        {
          insertOne: {
            document: {
              siteId: newId(),
              organizationId: world.organizationId,
              locationId: world.locationTwo,
              label: "x",
            },
          },
        },
      ]),
    );
    await expect(bulk).rejects.toMatchObject({ code: "LOCATION_FORBIDDEN" });
  });

  it("refuses an update that moves a row to a location outside the list", async () => {
    const world = await aWorld();
    const attempt = world.inLocationOne(() =>
      sites().updateOne({ label: "one" }, { $set: { locationId: world.locationTwo } }),
    );
    await expect(attempt).rejects.toMatchObject({ code: "LOCATION_FORBIDDEN", httpStatus: 403 });
  });

  it("does not touch rows of a location outside the list when updating or deleting", async () => {
    const world = await aWorld();
    const updated = await world.inLocationOne(() =>
      sites().updateMany({}, { $set: { label: "changed" } }),
    );
    expect(updated.matchedCount).toBe(1);
    const deleted = await world.inLocationOne(() => sites().deleteMany({}));
    expect(deleted.deletedCount).toBe(1);
    expect(await world.inAllLocations(() => sites().countDocuments())).toBe(1);
  });

  it("with ALL sees both locations", async () => {
    const world = await aWorld();
    expect(await world.inAllLocations(() => sites().countDocuments())).toBe(2);
  });

  it("throws errors.missing_location_context inside an organization context without locations", async () => {
    const world = await aWorld();
    const attempt = runWithRequestContext(
      { requestId: newId(), organizationId: world.organizationId },
      async () => sites().find().lean(),
    );
    await expect(attempt).rejects.toThrow(/errors\.missing_location_context/);
  });
});

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  auditAllIndexes,
  collectionsMissingRequiredIndexes,
  connectDatabases,
  initializeModels,
  models,
  type DatabaseConnections,
} from "../kernel/db/index.js";
import { listModelDefinitions } from "../kernel/db/model-registry.js";
import { registerAllModels } from "../register-all-models.js";
import {
  findFreePort,
  productionEnvironment,
  spawnApiEntry,
  stopSpawnedProcesses,
} from "../test-support/spawned-process.js";
import {
  createDatabaseTestConfig,
  createTestDatabaseUrls,
  disposeTestDatabases,
  installTestLogger,
} from "../test-support/test-databases.js";
import { syncIndexes } from "./sync-indexes.js";

// The same registration the server and the sync entry use, so the test covers every real collection.
registerAllModels();

const LOCATIONS_MODEL = "Location";
const LOCATIONS_NAME_INDEX = "organizationId_1_name_1";
const SPAWN_TIMEOUT_MS = 90_000;

let connections: DatabaseConnections;

beforeAll(async () => {
  installTestLogger();
  connections = await connectDatabases(createDatabaseTestConfig());
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

afterEach(() => {
  stopSpawnedProcesses();
});

/** The state of a production database before the first deploy: collections without their indexes. */
async function dropEveryIndex(): Promise<void> {
  for (const definition of listModelDefinitions()) {
    await models({}).get(definition.modelName).collection.dropIndexes();
  }
}

async function listLocationIndexes(): Promise<{ name: string; partial: boolean }[]> {
  const listed = await models({}).get(LOCATIONS_MODEL).listIndexes();
  return listed.map((index: { name: string; partialFilterExpression?: unknown }) => ({
    name: index.name,
    partial: index.partialFilterExpression !== undefined,
  }));
}

/** The old full unique index of `locations.name` that review finding J4 and plan 1.7b describe. */
async function createOldLocationNameIndex(): Promise<void> {
  const locations = models({}).get(LOCATIONS_MODEL).collection;
  await locations.dropIndexes();
  await locations.createIndex(
    { organizationId: 1, name: 1 },
    { unique: true, name: LOCATIONS_NAME_INDEX },
  );
}

describe("db:sync-indexes (finding J4)", () => {
  it("creates every declared index on a database without indexes", async () => {
    await dropEveryIndex();
    expect(collectionsMissingRequiredIndexes(await auditAllIndexes()).length).toBeGreaterThan(5);

    const outcome = await syncIndexes();

    expect(outcome.createdCount).toBeGreaterThan(20);
    expect(outcome.conflictCount).toBe(0);
    expect(collectionsMissingRequiredIndexes(await auditAllIndexes())).toEqual([]);
    expect((await auditAllIndexes()).flatMap((audit) => audit.missing)).toEqual([]);
  });

  it("finds everything already there on a second run and creates nothing", async () => {
    await dropEveryIndex();
    const first = await syncIndexes();

    const second = await syncIndexes();

    expect(second.createdCount).toBe(0);
    expect(second.conflictCount).toBe(0);
    for (const entry of second.collections) {
      const before = first.collections.find((candidate) => candidate.modelName === entry.modelName);
      expect(entry.alreadyThere, entry.collectionName).toBe(
        (before?.created ?? 0) + (before?.alreadyThere ?? 0),
      );
    }
  });

  it("reports an index with other options as conflicting, drops nothing and creates the rest", async () => {
    await dropEveryIndex();
    await createOldLocationNameIndex();

    const outcome = await syncIndexes();

    const locations = outcome.collections.find((entry) => entry.modelName === LOCATIONS_MODEL);
    expect(outcome.conflictCount).toBe(1);
    expect(locations?.conflicting).toHaveLength(1);
    expect(locations?.conflicting[0]?.existingName).toBe(LOCATIONS_NAME_INDEX);
    const afterwards = await listLocationIndexes();
    const old = afterwards.find((index) => index.name === LOCATIONS_NAME_INDEX);
    expect(old?.partial, "the old index is still there, unchanged").toBe(false);
    expect(afterwards.length).toBeGreaterThan(2);
  });

  it("counts a conflicting unique index as missing for the production guard", async () => {
    await dropEveryIndex();
    await syncIndexes();
    await createOldLocationNameIndex();

    const collections = collectionsMissingRequiredIndexes(await auditAllIndexes());

    expect(collections).toContain("locations");
  });
});

describe("production startup guard and the sync entry, as spawned processes", () => {
  it(
    "refuses to start without the unique indexes, then starts after the sync",
    async () => {
      const databases = createTestDatabaseUrls();
      const port = await findFreePort();
      const refused = spawnApiEntry("src/main.ts", productionEnvironment(databases, port, "api"));

      const refusedExit = await refused.waitForExit();

      expect(refusedExit).toBe(1);
      expect(refused.output()).toContain('"event":"db.indexes_missing"');
      expect(refused.output()).toContain("locations");
      expect(refused.output()).not.toContain('"event":"api.started"');
      const sync = spawnApiEntry(
        "src/seeds/run-sync-indexes.ts",
        productionEnvironment(databases, port, "api"),
      );
      expect(await sync.waitForExit()).toBe(0);
      expect(sync.output()).toContain('"event":"indexes.sync_done"');

      const started = spawnApiEntry("src/main.ts", productionEnvironment(databases, port, "api"));
      await started.waitForText('"event":"api.started"');
      expect(started.output()).not.toContain("db.indexes_missing");
    },
    SPAWN_TIMEOUT_MS,
  );

  it(
    "exits 1 from the sync entry when an index conflicts and leaves it in place",
    async () => {
      const databases = createTestDatabaseUrls();
      const own = await connectDatabases(createDatabaseTestConfig(databases));
      try {
        await own.platform
          .collection("locations")
          .createIndex(
            { organizationId: 1, name: 1 },
            { unique: true, name: LOCATIONS_NAME_INDEX },
          );
        const sync = spawnApiEntry(
          "src/seeds/run-sync-indexes.ts",
          productionEnvironment(databases, await findFreePort(), "api"),
        );

        const exitCode = await sync.waitForExit();

        expect(exitCode).toBe(1);
        expect(sync.output()).toContain('"event":"indexes.conflict"');
        expect(sync.output()).toContain(`dropIndex(\\"${LOCATIONS_NAME_INDEX}\\")`);
        const remaining = await own.platform.collection("locations").indexes();
        expect(remaining.map((index) => index.name)).toContain(LOCATIONS_NAME_INDEX);
      } finally {
        await own.platform.dropDatabase();
        await own.tenantShared.dropDatabase();
        await own.close();
      }
    },
    SPAWN_TIMEOUT_MS,
  );
});

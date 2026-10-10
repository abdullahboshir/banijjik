import { PACKAGE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initializeModels, type DatabaseConnections } from "../kernel/db/index.js";
import { SEED_PACKAGES } from "../modules/platform/package/index.js";
import { registerModuleModels } from "../routes/v1.js";
import { MutableClock } from "../test-support/mutable-clock.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../test-support/test-databases.js";
import { seedPackages } from "./seed-packages.js";

registerModuleModels();

let connections: DatabaseConnections;
const clock = new MutableClock();

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

function packages() {
  return connections.platform.collection("packages");
}

describe("seedPackages", () => {
  it("inserts every seed package once, and a second run leaves the same documents", async () => {
    const first = await seedPackages(clock);
    const documentsAfterFirst = await packages().find({}).sort({ packageKey: 1 }).toArray();
    const second = await seedPackages(clock);
    const documentsAfterSecond = await packages().find({}).sort({ packageKey: 1 }).toArray();

    expect(first.createdCount).toBe(SEED_PACKAGES.length);
    expect(second.createdCount).toBe(0);
    expect(documentsAfterSecond).toEqual(documentsAfterFirst);
  });

  it("does not overwrite a package that an operator edited", async () => {
    await packages().updateOne(
      { packageKey: PACKAGE_KEY.BUNDLE },
      { $set: { "limits.members": 99 }, $inc: { version: 1 } },
    );

    await seedPackages(clock);

    const bundle = await packages().findOne({ packageKey: PACKAGE_KEY.BUNDLE });
    expect(bundle?.["limits"]).toMatchObject({ members: 99 });
    expect(bundle?.["version"]).toBe(2);
  });

  it("adds only the package that is missing", async () => {
    await packages().deleteOne({ packageKey: PACKAGE_KEY.PACK_SMS_500 });

    const outcome = await seedPackages(clock);

    expect(outcome.createdCount).toBe(1);
    expect(await packages().countDocuments()).toBe(SEED_PACKAGES.length);
  });
});

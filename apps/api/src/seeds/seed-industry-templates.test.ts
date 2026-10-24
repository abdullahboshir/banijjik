import { SEED_INDUSTRY_TEMPLATE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initializeModels, type DatabaseConnections } from "../kernel/db/index.js";
import { registerModuleModels } from "../routes/v1.js";
import { MutableClock } from "../test-support/mutable-clock.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../test-support/test-databases.js";
import { seedIndustryTemplates } from "./seed-industry-templates.js";

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

function templates() {
  return connections.platform.collection("industry_templates");
}

describe("seedIndustryTemplates", () => {
  it("seeds an empty database with the ten templates, and a second run inserts nothing", async () => {
    const first = await seedIndustryTemplates(clock);
    const documentsAfterFirst = await templates()
      .find({})
      .sort({ industryTemplateKey: 1 })
      .toArray();
    const second = await seedIndustryTemplates(clock);
    const documentsAfterSecond = await templates()
      .find({})
      .sort({ industryTemplateKey: 1 })
      .toArray();

    expect(first.createdCount).toBe(10);
    expect(second.createdCount).toBe(0);
    expect(documentsAfterSecond).toEqual(documentsAfterFirst);
  });

  it("does not overwrite a template an operator edited", async () => {
    await templates().updateOne(
      { industryTemplateKey: SEED_INDUSTRY_TEMPLATE_KEY.RETAIL },
      { $set: { "name.en": "Edited shop" } },
    );

    await seedIndustryTemplates(clock);

    const retail = await templates().findOne({
      industryTemplateKey: SEED_INDUSTRY_TEMPLATE_KEY.RETAIL,
    });
    expect(retail?.["name"]).toMatchObject({ en: "Edited shop" });
  });

  it("adds only the template that is missing", async () => {
    await templates().deleteOne({ industryTemplateKey: SEED_INDUSTRY_TEMPLATE_KEY.HOSTEL });

    const outcome = await seedIndustryTemplates(clock);

    expect(outcome.createdCount).toBe(1);
    expect(await templates().countDocuments()).toBe(10);
  });
});

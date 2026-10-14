import {
  ERROR_CODE,
  SEED_INDUSTRY_TEMPLATE_KEY,
  type IndustryTemplateKey,
} from "@banijjik/contracts";
import { beforeAll, describe, expect, it } from "vitest";
import { MutableClock } from "../../../../test-support/mutable-clock.js";
import { installTestLogger } from "../../../../test-support/test-databases.js";
import type {
  IndustryTemplatePage,
  IndustryTemplateRepository,
} from "../application/ports/industry-template-repository.js";
import { IndustryTemplate } from "../domain/industry-template.entity.js";
import { CachedIndustryTemplateReader } from "./cached-industry-template-reader.js";
import { loadSeedIndustryTemplates } from "./load-seed-templates.js";
import { InMemoryLruCache } from "../../../../kernel/cache/index.js";
import { INDUSTRY_TEMPLATE_VIEW_CACHE_TTL_MILLISECONDS } from "./cached-industry-template-reader.js";

const NOW = new Date("2026-10-14T08:00:00.000Z");
const THIRTY_ONE_SECONDS = 31;

class MemoryTemplates implements IndustryTemplateRepository {
  finds = 0;
  private readonly rows = new Map<string, IndustryTemplate>();

  add(template: IndustryTemplate): void {
    this.rows.set(template.industryTemplateKey, template);
  }

  async findByKey(templateKey: IndustryTemplateKey): Promise<IndustryTemplate | undefined> {
    this.finds += 1;
    return this.rows.get(templateKey);
  }

  async insert(): Promise<void> {
    throw new Error("not used");
  }

  async update(): Promise<IndustryTemplate> {
    throw new Error("not used");
  }

  async reservePublished(): Promise<boolean> {
    throw new Error("not used");
  }

  async findExistingKeys(): Promise<ReadonlySet<string>> {
    throw new Error("not used");
  }

  async findById(): Promise<IndustryTemplate | undefined> {
    throw new Error("not used");
  }

  async listPublished(): Promise<readonly IndustryTemplate[]> {
    throw new Error("not used");
  }

  async list(): Promise<IndustryTemplatePage> {
    throw new Error("not used");
  }
}

function aReader(templates: MemoryTemplates, clock: MutableClock): CachedIndustryTemplateReader {
  return new CachedIndustryTemplateReader({
    templates,
    cache: new InMemoryLruCache({
      clock,
      ttlMilliseconds: INDUSTRY_TEMPLATE_VIEW_CACHE_TTL_MILLISECONDS,
    }),
  });
}

describe("CachedIndustryTemplateReader", () => {
  beforeAll(() => {
    installTestLogger();
  });

  it("returns modules, kinds and version for a draft and a retired template", async () => {
    const salon = loadSeedIndustryTemplates().find(
      (entry) => entry.industryTemplateKey === SEED_INDUSTRY_TEMPLATE_KEY.SALON,
    );
    if (salon === undefined) throw new Error("salon seed missing");
    const templates = new MemoryTemplates();
    templates.add(IndustryTemplate.create({ ...salon, now: NOW }));
    templates.add(
      IndustryTemplate.create({
        ...salon,
        industryTemplateKey: "RETIRED_SHOP",
        status: "RETIRED",
        now: NOW,
      }),
    );
    const reader = aReader(templates, new MutableClock(NOW));

    const draft = await reader.find(SEED_INDUSTRY_TEMPLATE_KEY.SALON);
    const retired = await reader.find("RETIRED_SHOP" as IndustryTemplateKey);

    expect(draft.templateVersion).toBe(1);
    expect(draft.enabledKinds).toEqual(["SERVICE", "PRODUCT"]);
    expect(draft.allowedModuleKeys).toContain("booking");
    expect(retired.allowedModuleKeys).toEqual(draft.allowedModuleKeys);
    expect(retired.templateVersion).toBe(1);
  });

  it("reuses a view for 30 seconds and reads again after that", async () => {
    const retail = loadSeedIndustryTemplates().find(
      (entry) => entry.industryTemplateKey === SEED_INDUSTRY_TEMPLATE_KEY.RETAIL,
    );
    if (retail === undefined) throw new Error("retail seed missing");
    const clock = new MutableClock(NOW);
    const templates = new MemoryTemplates();
    templates.add(IndustryTemplate.create({ ...retail, now: NOW }));
    const reader = aReader(templates, clock);

    await reader.find(SEED_INDUSTRY_TEMPLATE_KEY.RETAIL);
    await reader.find(SEED_INDUSTRY_TEMPLATE_KEY.RETAIL);
    expect(templates.finds).toBe(1);

    clock.advanceSeconds(THIRTY_ONE_SECONDS);
    await reader.find(SEED_INDUSTRY_TEMPLATE_KEY.RETAIL);

    expect(templates.finds).toBe(2);
  });

  it("throws when the row is missing and does not allow every module", async () => {
    const reader = aReader(new MemoryTemplates(), new MutableClock(NOW));

    await expect(reader.find(SEED_INDUSTRY_TEMPLATE_KEY.RETAIL)).rejects.toMatchObject({
      code: ERROR_CODE.INTERNAL,
      messageKey: "errors.industry_template_missing",
    });
  });
});

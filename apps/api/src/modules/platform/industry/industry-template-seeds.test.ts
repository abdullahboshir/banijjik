import { INDUSTRY_TEMPLATE_STATUS, SEED_INDUSTRY_TEMPLATE_KEY } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import type { IndustryTemplateRepository } from "./application/ports/industry-template-repository.js";
import { EnsureSeedIndustryTemplatesUseCase } from "./application/use-cases/ensure-seed-industry-templates.use-case.js";
import { IndustryTemplate } from "./domain/industry-template.entity.js";
import { loadSeedIndustryTemplates } from "./infrastructure/load-seed-templates.js";

const COMMON_TERM_KEYS = [
  "contact",
  "offering",
  "order",
  "booking",
  "enrollment",
  "resource",
  "location",
];

const templates = loadSeedIndustryTemplates();

function templateNamed(key: string) {
  const found = templates.find((entry) => entry.industryTemplateKey === key);
  if (found === undefined) throw new Error(`missing seed ${key}`);
  return found;
}

describe("industry template seed files", () => {
  it("parses every file with the configuration schema and the domain factory", () => {
    const now = new Date("2026-10-14T08:00:00.000Z");

    const created = templates.map((entry) => IndustryTemplate.create({ ...entry, now }));

    expect(created).toHaveLength(10);
    expect(created.map((entry) => entry.version)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  });

  it("publishes only FCOMMERCE and RETAIL", () => {
    const published = templates
      .filter((entry) => entry.status === INDUSTRY_TEMPLATE_STATUS.PUBLISHED)
      .map((entry) => entry.industryTemplateKey);

    expect(published).toEqual([
      SEED_INDUSTRY_TEMPLATE_KEY.FCOMMERCE,
      SEED_INDUSTRY_TEMPLATE_KEY.RETAIL,
    ]);
  });

  it("keeps the common terms in every file", () => {
    for (const entry of templates) {
      expect(Object.keys(entry.configuration.terms), entry.industryTemplateKey).toEqual(
        expect.arrayContaining(COMMON_TERM_KEYS),
      );
    }
  });

  it("matches the spot checks from the template document", () => {
    const fcommerce = templateNamed(SEED_INDUSTRY_TEMPLATE_KEY.FCOMMERCE);
    const clinic = templateNamed(SEED_INDUSTRY_TEMPLATE_KEY.CLINIC);
    const coaching = templateNamed(SEED_INDUSTRY_TEMPLATE_KEY.COACHING);
    const restaurant = templateNamed(SEED_INDUSTRY_TEMPLATE_KEY.RESTAURANT);
    const guardian = coaching.configuration.customFields.find(
      (field) => field.fieldKey === "guardian",
    );
    const size = restaurant.configuration.modifierGroupsSeed?.find(
      (group) => group.name === "Size",
    );

    expect(fcommerce.allowedModuleKeys).toHaveLength(20);
    expect(clinic.enabledKinds).toEqual(["SERVICE"]);
    expect(guardian?.link?.relationKey).toBe("GUARDIAN_OF");
    expect(size).toMatchObject({
      selection: "SINGLE",
      isRequired: true,
      minSelect: 1,
      maxSelect: 1,
    });
  });

  it("gives every custom field a Bangla and English label, and every choice an option label", () => {
    for (const entry of templates) {
      for (const field of entry.configuration.customFields) {
        expect(field.label?.bn, `${entry.industryTemplateKey} ${field.fieldKey}`).toEqual(
          expect.any(String),
        );
        expect(field.label?.en, `${entry.industryTemplateKey} ${field.fieldKey}`).toEqual(
          expect.any(String),
        );
        if (field.fieldType !== "SELECT" && field.fieldType !== "MULTI_SELECT") continue;
        for (const option of field.options ?? []) {
          expect(
            field.optionLabels?.[option],
            `${entry.industryTemplateKey} ${field.fieldKey} ${option}`,
          ).toEqual({ bn: expect.any(String), en: expect.any(String) });
        }
      }
    }
  });

  it("seeds both matrimony templates as DRAFT and parses them with the seed schema", () => {
    const islamic = templateNamed(SEED_INDUSTRY_TEMPLATE_KEY.MATRIMONY_ISLAMIC);
    const general = templateNamed(SEED_INDUSTRY_TEMPLATE_KEY.MATRIMONY);

    expect(islamic.status).toBe(INDUSTRY_TEMPLATE_STATUS.DRAFT);
    expect(general.status).toBe(INDUSTRY_TEMPLATE_STATUS.DRAFT);
    expect(islamic.enabledKinds).toEqual(["SERVICE"]);
    expect(islamic.allowedModuleKeys).toContain("directory");
    expect(islamic.configuration.directory?.listingNumberPrefix).toBe("BIO");
    expect(general.configuration.directory?.listingNumberPrefix).toBe("BIO");
    // A DRAFT template is never offered at signup, so nobody signs up before the storefront (M.6).
    const published = templates
      .filter((entry) => entry.status === INDUSTRY_TEMPLATE_STATUS.PUBLISHED)
      .map((entry) => entry.industryTemplateKey);
    expect(published).not.toContain(SEED_INDUSTRY_TEMPLATE_KEY.MATRIMONY_ISLAMIC);
    expect(published).not.toContain(SEED_INDUSTRY_TEMPLATE_KEY.MATRIMONY);
  });

  it("gives both matrimony templates the five trust-and-safety report reasons", () => {
    const expectedKeys = [
      "fake_profile",
      "already_married",
      "inappropriate_content",
      "contact_misuse",
      "other",
    ];
    const keys = [
      SEED_INDUSTRY_TEMPLATE_KEY.MATRIMONY_ISLAMIC,
      SEED_INDUSTRY_TEMPLATE_KEY.MATRIMONY,
    ];
    for (const templateKey of keys) {
      const reasons = templateNamed(templateKey).configuration.directory?.reportReasons ?? [];
      expect(
        reasons.map((reason) => reason.reasonKey),
        templateKey,
      ).toEqual(expectedKeys);
      for (const reason of reasons) {
        expect(reason.label.bn, `${templateKey} ${reason.reasonKey}`).toEqual(expect.any(String));
        expect(reason.label.en, `${templateKey} ${reason.reasonKey}`).toEqual(expect.any(String));
      }
    }
  });

  it("a second seed run leaves an edited matrimony template unchanged (insert-only, ADR-076)", async () => {
    const stored = new Map<string, { readonly name: unknown }>();
    const templatesRepo = {
      async insert(template: IndustryTemplate): Promise<void> {
        stored.set(template.industryTemplateKey, { name: template.name });
      },
      async findExistingKeys(keys: readonly string[]): Promise<ReadonlySet<string>> {
        return new Set(keys.filter((key) => stored.has(key)));
      },
    } as unknown as IndustryTemplateRepository;
    const clock = { now: () => new Date("2026-10-23T08:00:00.000Z") };

    const first = await new EnsureSeedIndustryTemplatesUseCase({
      templates: templatesRepo,
      seed: templates,
      clock,
    }).execute();
    expect(first.createdCount).toBe(10);

    // An operator edits the seeded draft; after the first seed the database is the source of truth.
    const edited = { name: { bn: "সম্পাদিত", en: "Edited" } };
    stored.set(SEED_INDUSTRY_TEMPLATE_KEY.MATRIMONY_ISLAMIC, edited);

    const second = await new EnsureSeedIndustryTemplatesUseCase({
      templates: templatesRepo,
      seed: templates,
      clock,
    }).execute();
    expect(second.createdCount).toBe(0);
    expect(stored.get(SEED_INDUSTRY_TEMPLATE_KEY.MATRIMONY_ISLAMIC)).toBe(edited);
  });
});

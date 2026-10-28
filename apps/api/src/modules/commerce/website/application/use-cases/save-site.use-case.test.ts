import { ERROR_CODE } from "@banijjik/contracts";
import {
  CONSERVATIVE_PAGE_RULES,
  SECTION_KEY,
  type SiteDesign,
  type SiteEditPolicy,
} from "@banijjik/contracts/website";
import { asId, newId, type OrganizationId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { MutableClock } from "../../../../../test-support/mutable-clock.js";
import { Site } from "../../domain/site.entity.js";
import type { SiteRepository } from "../ports/site-repository.js";
import { SaveSiteDraftUseCase } from "./save-site.use-case.js";

const ID_A = "01926b48-1234-7abc-8def-0123456789a1";
const ID_B = "01926b48-1234-7abc-8def-0123456789a2";
const ID_C = "01926b48-1234-7abc-8def-0123456789a3";
const ID_D = "01926b48-1234-7abc-8def-0123456789a4";
const TEXT = { bn: "শিরোনাম", en: "Title" };

function sampleDesign(): SiteDesign {
  return {
    schemaVersion: 1,
    tokens: {
      color: {
        primary: "#15803d",
        accent: "#16a34a",
        background: "#ffffff",
        surface: "#f8fafc",
        text: "#0f172a",
        mutedText: "#334155",
        onPrimary: "#ffffff",
        focus: "#1d4ed8",
      },
      type: { fontPairKey: "inter-noto", scale: "MEDIUM" },
      shape: {
        cardRadius: "MEDIUM",
        buttonRadius: "MEDIUM",
        inputRadius: "SMALL",
        imageRadius: "SMALL",
        border: "THIN",
        shadow: "LOW",
      },
      spacing: { density: "COMFORTABLE" },
      size: {
        imageRatio: "LANDSCAPE",
        cardSize: "MEDIUM",
        columns: { mobile: 1, tablet: 2, desktop: 3 },
      },
    },
    header: {
      sectionId: ID_A,
      sectionKey: "header",
      variantKey: "SIMPLE",
      regionKey: "header",
      binding: null,
      content: { links: [{ label: TEXT, path: "/home" }] },
    },
    footer: {
      sectionId: ID_B,
      sectionKey: "footer",
      variantKey: "SIMPLE",
      regionKey: "footer",
      binding: null,
      content: { links: [{ label: TEXT, path: "/home" }] },
    },
    pages: [
      {
        pageId: ID_C,
        path: "/home",
        title: TEXT,
        seo: { description: { bn: "", en: "" }, noIndex: false },
        sections: [
          {
            sectionId: ID_D,
            sectionKey: "hero",
            variantKey: "SPLIT",
            regionKey: "main",
            binding: null,
            content: { heading: TEXT, body: { bn: "স্বাগতম", en: "Welcome" } },
          },
        ],
      },
    ],
    staticContent: [],
  };
}

function openPolicy(): SiteEditPolicy {
  return {
    regions: [
      {
        regionKey: "header",
        lock: "LOCKED",
        required: true,
        sectionKeys: ["header"],
        maxSections: 1,
        editableContentKeys: [],
      },
      {
        regionKey: "footer",
        lock: "FULL",
        required: true,
        sectionKeys: ["footer"],
        maxSections: 1,
        editableContentKeys: ["links"],
      },
      {
        regionKey: "main",
        lock: "FULL",
        required: false,
        sectionKeys: ["hero", "rich-text"],
        maxSections: 5,
        editableContentKeys: [],
      },
    ],
    tokenGroups: { color: true, type: true, shape: true, spacing: true, size: true },
    allowedColors: null,
    allowedVariantsBySection: {
      header: ["SIMPLE"],
      footer: ["SIMPLE"],
      hero: ["SPLIT", "CENTERED"],
    },
    pageRules: { ...CONSERVATIVE_PAGE_RULES, allowPathChange: false },
  };
}

class InMemorySiteRepository implements SiteRepository {
  site: Site | undefined;

  async findCurrent(): Promise<Site | undefined> {
    return this.site;
  }

  async insert(site: Site): Promise<"inserted" | "duplicate"> {
    if (this.site !== undefined) return "duplicate";
    this.site = site;
    return "inserted";
  }

  async save(site: Site, expectedVersion: number): Promise<void> {
    if (this.site === undefined || this.site.version !== expectedVersion) {
      throw new Error("stale");
    }
    this.site = site;
  }
}

function seedSite(repository: InMemorySiteRepository): Site {
  const site = Site.create({
    organizationId: asId<OrganizationId>(newId()),
    draftDesign: sampleDesign(),
    editPolicy: openPolicy(),
    sourceTemplateKey: "retail-starter",
    sourceTemplateRevision: 1,
    now: new Date("2026-10-28T00:00:00.000Z"),
    actorUserId: asId<UserId>(newId()),
  });
  repository.site = site;
  return site;
}

describe("SaveSiteDraftUseCase", () => {
  it("saves a policy-allowed draft and bumps version", async () => {
    const sites = new InMemorySiteRepository();
    const existing = seedSite(sites);
    const useCase = new SaveSiteDraftUseCase({ sites, clock: new MutableClock() });
    const next = structuredClone(existing.draftDesign);
    const page = next.pages[0];
    if (page?.sections[0] === undefined) throw new Error("fixture hero missing");
    page.sections = [{ ...page.sections[0], variantKey: "CENTERED" }];

    const saved = await useCase.execute({
      actorUserId: asId<UserId>(newId()),
      effectiveSectionKeys: Object.values(SECTION_KEY),
      body: { expectedVersion: 1, design: next },
    });

    expect(saved.version).toBe(2);
    expect(saved.design.pages[0]?.sections[0]?.variantKey).toBe("CENTERED");
    expect(saved.policy).toEqual(existing.editPolicy);
  });

  it("refuses a stale expectedVersion before writing", async () => {
    const sites = new InMemorySiteRepository();
    seedSite(sites);
    const useCase = new SaveSiteDraftUseCase({ sites, clock: new MutableClock() });

    await expect(
      useCase.execute({
        actorUserId: asId<UserId>(newId()),
        effectiveSectionKeys: Object.values(SECTION_KEY),
        body: { expectedVersion: 9, design: sampleDesign() },
      }),
    ).rejects.toMatchObject({ code: ERROR_CODE.CONFLICT });
    expect(sites.site?.version).toBe(1);
  });

  it("refuses a locked header edit and leaves the stored draft unchanged", async () => {
    const sites = new InMemorySiteRepository();
    const existing = seedSite(sites);
    const useCase = new SaveSiteDraftUseCase({ sites, clock: new MutableClock() });
    const next = structuredClone(existing.draftDesign);
    next.header = { ...next.header, variantKey: "CENTERED" };

    await expect(
      useCase.execute({
        actorUserId: asId<UserId>(newId()),
        effectiveSectionKeys: Object.values(SECTION_KEY),
        body: { expectedVersion: 1, design: next },
      }),
    ).rejects.toMatchObject({ code: ERROR_CODE.BUSINESS_RULE });
    expect(sites.site?.draftDesign.header.variantKey).toBe("SIMPLE");
  });

  it("answers NOT_FOUND when the organization has no site yet", async () => {
    const useCase = new SaveSiteDraftUseCase({
      sites: new InMemorySiteRepository(),
      clock: new MutableClock(),
    });

    await expect(
      useCase.execute({
        actorUserId: asId<UserId>(newId()),
        effectiveSectionKeys: Object.values(SECTION_KEY),
        body: { expectedVersion: 1, design: sampleDesign() },
      }),
    ).rejects.toMatchObject({ code: ERROR_CODE.NOT_FOUND });
  });
});

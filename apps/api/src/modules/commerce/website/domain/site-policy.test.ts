import { ERROR_CODE } from "@banijjik/contracts";
import {
  CONSERVATIVE_PAGE_RULES,
  LOCKED_TOKEN_GROUPS,
  SECTION_KEY,
  type SiteDesign,
  type SiteEditPolicy,
  type SiteSection,
} from "@banijjik/contracts/website";
import { describe, expect, it } from "vitest";
import { DomainRuleError } from "./errors.js";
import { sitePolicyEvaluator } from "./site-policy.js";

const ID_A = "01926b48-1234-7abc-8def-0123456789a1";
const ID_B = "01926b48-1234-7abc-8def-0123456789a2";
const ID_C = "01926b48-1234-7abc-8def-0123456789a3";
const ID_D = "01926b48-1234-7abc-8def-0123456789a4";
const ID_E = "01926b48-1234-7abc-8def-0123456789a5";
const TEXT = { bn: "শিরোনাম", en: "Title" };
const ALL_KEYS = Object.values(SECTION_KEY);

function tokens() {
  return {
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
    type: { fontPairKey: "inter-noto" as const, scale: "MEDIUM" as const },
    shape: {
      cardRadius: "MEDIUM" as const,
      buttonRadius: "MEDIUM" as const,
      inputRadius: "SMALL" as const,
      imageRadius: "SMALL" as const,
      border: "THIN" as const,
      shadow: "LOW" as const,
    },
    spacing: { density: "COMFORTABLE" as const },
    size: {
      imageRatio: "LANDSCAPE" as const,
      cardSize: "MEDIUM" as const,
      columns: { mobile: 1 as const, tablet: 2 as const, desktop: 3 as const },
    },
  };
}

function chrome(sectionKey: "header" | "footer", sectionId: string): SiteSection {
  return {
    sectionId,
    sectionKey,
    variantKey: "SIMPLE",
    regionKey: sectionKey,
    binding: null,
    content: { links: [{ label: TEXT, path: "/home" }] },
  };
}

function sampleDesign(): SiteDesign {
  return {
    schemaVersion: 1,
    tokens: tokens(),
    header: chrome("header", ID_A),
    footer: chrome("footer", ID_B),
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

function samplePolicy(): SiteEditPolicy {
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
        lock: "CONTENT_ONLY",
        required: true,
        sectionKeys: ["footer"],
        maxSections: 1,
        editableContentKeys: ["links"],
      },
      {
        regionKey: "main",
        lock: "FULL",
        required: false,
        sectionKeys: ["hero", "rich-text", "faq"],
        maxSections: 5,
        editableContentKeys: [],
      },
      {
        regionKey: "static.ABOUT",
        lock: "CONTENT_ONLY",
        required: false,
        sectionKeys: [],
        maxSections: 1,
        editableContentKeys: ["title", "body"],
      },
    ],
    tokenGroups: { color: true, type: false, shape: true, spacing: true, size: true },
    allowedColors: null,
    allowedVariantsBySection: {
      header: ["SIMPLE"],
      footer: ["SIMPLE", "COLUMNS"],
      hero: ["SPLIT", "CENTERED"],
      "rich-text": ["STANDARD"],
    },
    pageRules: CONSERVATIVE_PAGE_RULES,
  };
}

function assertAllowed(next: SiteDesign, previous = sampleDesign(), policy = samplePolicy()) {
  sitePolicyEvaluator.assertAllowed({
    previous,
    next,
    policy,
    effectiveSectionKeys: ALL_KEYS,
  });
}

function reasonOf(run: () => void): string {
  try {
    run();
    throw new Error("expected policy denial");
  } catch (error) {
    if (error instanceof DomainRuleError && typeof error.details?.["reason"] === "string") {
      return error.details["reason"];
    }
    throw error;
  }
}

describe("sitePolicyEvaluator", () => {
  it("allows an unchanged document", () => {
    expect(() => assertAllowed(sampleDesign())).not.toThrow();
  });

  it("refuses a locked header content change", () => {
    const next = sampleDesign();
    next.header = {
      ...next.header,
      content: { links: [{ label: TEXT, path: "/about" }] },
    };
    expect(reasonOf(() => assertAllowed(next))).toBe("locked_section");
  });

  it("refuses a locked token group change", () => {
    const next = sampleDesign();
    next.tokens = { ...next.tokens, type: { ...next.tokens.type, scale: "LARGE" } };
    expect(reasonOf(() => assertAllowed(next))).toBe("locked_token_group:type");
  });

  it("allows a content-only footer link change and refuses a variant change", () => {
    const next = sampleDesign();
    next.footer = {
      ...next.footer,
      content: { links: [{ label: TEXT, path: "/contact" }] },
    };
    expect(() => assertAllowed(next)).not.toThrow();
    next.footer = { ...next.footer, variantKey: "COLUMNS" };
    expect(reasonOf(() => assertAllowed(next))).toBe("locked_variant");
  });

  it("refuses moving a locked header by replacing it with a new sectionId", () => {
    const next = sampleDesign();
    next.header = { ...next.header, sectionId: ID_E };
    expect(reasonOf(() => assertAllowed(next))).toBe("delete_locked_section");
  });

  it("refuses reusing another sectionId", () => {
    const next = sampleDesign();
    const page = next.pages[0];
    if (page === undefined) throw new Error("fixture page missing");
    const hero = page.sections[0];
    if (hero === undefined) throw new Error("fixture hero missing");
    page.sections = [{ ...hero, sectionId: ID_A }];
    expect(reasonOf(() => assertAllowed(next))).toBe("duplicate_section_id");
  });

  it("refuses deleting then reinserting a locked section to bypass the lock", () => {
    const next = sampleDesign();
    next.header = { ...chrome("header", ID_E), content: { links: [] } };
    expect(reasonOf(() => assertAllowed(next))).toBe("delete_locked_section");
  });

  it("refuses a hero variant outside the policy palette", () => {
    const next = sampleDesign();
    const page = next.pages[0];
    if (page?.sections[0] === undefined) throw new Error("fixture hero missing");
    page.sections = [{ ...page.sections[0], variantKey: "SPLIT" }];
    const policy = samplePolicy();
    policy.allowedVariantsBySection = { ...policy.allowedVariantsBySection, hero: ["CENTERED"] };
    expect(reasonOf(() => assertAllowed(next, sampleDesign(), policy))).toBe("variant_not_allowed");
  });

  it("allows a FULL-region variant that is in both the palette and the registry", () => {
    const next = sampleDesign();
    const page = next.pages[0];
    if (page?.sections[0] === undefined) throw new Error("fixture hero missing");
    page.sections = [{ ...page.sections[0], variantKey: "CENTERED" }];
    expect(() => assertAllowed(next)).not.toThrow();
  });

  it("refuses creating a page under conservative pageRules", () => {
    const next = sampleDesign();
    next.pages = [
      ...next.pages,
      {
        pageId: ID_E,
        path: "/extra",
        title: TEXT,
        seo: { description: { bn: "", en: "" }, noIndex: false },
        sections: [],
      },
    ];
    expect(reasonOf(() => assertAllowed(next))).toBe("page_create_denied");
  });

  it("refuses deleting a page under conservative pageRules", () => {
    const next = sampleDesign();
    next.pages = [];
    expect(reasonOf(() => assertAllowed(next))).toBe("page_delete_denied");
  });

  it("refuses a path change and a noIndex change", () => {
    const next = sampleDesign();
    const page = next.pages[0];
    if (page === undefined) throw new Error("fixture page missing");
    next.pages = [{ ...page, path: "/moved" }];
    expect(reasonOf(() => assertAllowed(next))).toBe("path_change_denied");
    const indexed = sampleDesign();
    const home = indexed.pages[0];
    if (home === undefined) throw new Error("fixture page missing");
    indexed.pages = [{ ...home, seo: { ...home.seo, noIndex: true } }];
    expect(reasonOf(() => assertAllowed(indexed))).toBe("locked_no_index");
  });

  it("refuses a missing policy region change", () => {
    const next = sampleDesign();
    const page = next.pages[0];
    if (page?.sections[0] === undefined) throw new Error("fixture hero missing");
    page.sections = [{ ...page.sections[0], regionKey: "sidebar" }];
    expect(reasonOf(() => assertAllowed(next))).toBe("reparent_denied");
  });

  it("refuses adding a section whose module is not in effectiveSectionKeys", () => {
    const next = sampleDesign();
    const page = next.pages[0];
    if (page === undefined) throw new Error("fixture page missing");
    page.sections = [
      ...page.sections,
      {
        sectionId: ID_E,
        sectionKey: "faq",
        variantKey: "STACKED",
        regionKey: "main",
        binding: null,
        content: { entries: [] },
      },
    ];
    expect(() => {
      sitePolicyEvaluator.assertAllowed({
        previous: sampleDesign(),
        next,
        policy: samplePolicy(),
        effectiveSectionKeys: [SECTION_KEY.header, SECTION_KEY.footer, SECTION_KEY.hero],
      });
    }).toThrow();
  });

  it("refuses a colour outside allowedColors", () => {
    const policy = samplePolicy();
    policy.allowedColors = ["#15803d"];
    const next = sampleDesign();
    expect(reasonOf(() => assertAllowed(next, sampleDesign(), policy))).toBe("color_not_allowed");
  });

  it("refuses changing includeInPublication on a content-only static page", () => {
    const previous = sampleDesign();
    previous.staticContent = [
      { pageKey: "ABOUT", title: TEXT, body: TEXT, includeInPublication: true },
    ];
    const next = structuredClone(previous);
    const about = next.staticContent[0];
    if (about === undefined) throw new Error("fixture static missing");
    about.includeInPublication = false;
    expect(reasonOf(() => assertAllowed(next, previous))).toBe("locked_static_content");
  });

  it("uses BUSINESS_RULE for a denial", () => {
    const next = sampleDesign();
    next.header = { ...next.header, variantKey: "CENTERED" };
    try {
      assertAllowed(next);
      throw new Error("expected denial");
    } catch (error) {
      expect(error).toMatchObject({ code: ERROR_CODE.BUSINESS_RULE });
    }
  });
});

describe("locked token groups constant", () => {
  it("starts with every group closed", () => {
    expect(LOCKED_TOKEN_GROUPS).toEqual({
      color: false,
      type: false,
      shape: false,
      spacing: false,
      size: false,
    });
  });
});

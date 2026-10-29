import { ERROR_CODE } from "@banijjik/contracts";
import {
  SECTION_KEY,
  SITE_DESIGN_BOUNDS,
  type PublishedSiteDesign,
  type SiteDesign,
  type SitePage,
  type SiteSection,
  type SiteTokens,
  type StaticPageDraft,
} from "@banijjik/contracts/website";
import { describe, expect, it } from "vitest";
import { DomainRuleError } from "./errors.js";
import {
  assertRenderableSchemaVersion,
  collectImageFileIds,
  projectPublishedDesign,
  republishPublishedDesign,
} from "./site-projection.js";

const PAGE_ID = "01926b48-1234-7abc-8def-0123456789a3";
const FILE_A = "01926b48-1234-7abc-8def-0123456789b1";
const FILE_B = "01926b48-1234-7abc-8def-0123456789b2";
const SECTION_ID = {
  hero: "01926b48-1234-7abc-8def-0123456789a1",
  secondHero: "01926b48-1234-7abc-8def-0123456789a2",
  grid: "01926b48-1234-7abc-8def-0123456789a7",
  directory: "01926b48-1234-7abc-8def-0123456789a6",
} as const;
const CHROME_KEYS = [SECTION_KEY.header, SECTION_KEY.footer];
const TEXT = { bn: "শিরোনাম", en: "Title" };

function sampleTokens(): SiteTokens {
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
  };
}

function chrome(sectionKey: "header" | "footer"): SiteSection {
  return {
    sectionId: `01926b48-1234-7abc-8def-0123456789${sectionKey === "header" ? "a4" : "a5"}`,
    sectionKey,
    variantKey: "SIMPLE",
    regionKey: sectionKey,
    binding: null,
    content: { links: [{ label: TEXT, path: "/home" }] },
  };
}

function hero(sectionId: string, imageFileId?: string): SiteSection {
  return {
    sectionId,
    sectionKey: SECTION_KEY.hero,
    variantKey: "SPLIT",
    regionKey: "main",
    binding: null,
    content:
      imageFileId === undefined
        ? { heading: TEXT, body: TEXT }
        : { heading: TEXT, body: TEXT, imageFileId },
  };
}

function moduleSection(sectionKey: "offering-grid" | "directory-list"): SiteSection {
  return {
    sectionId: sectionKey === "offering-grid" ? SECTION_ID.grid : SECTION_ID.directory,
    sectionKey,
    variantKey: "GRID",
    regionKey: "main",
    binding: null,
    content: { heading: TEXT },
  };
}

function aboutPage(pageKey: "ABOUT" | "PRIVACY", includeInPublication: boolean): StaticPageDraft {
  return { pageKey, title: TEXT, body: TEXT, includeInPublication };
}

function sampleDesign(
  sections: readonly SiteSection[] = [hero(SECTION_ID.hero, FILE_A)],
): SiteDesign {
  const page: SitePage = {
    pageId: PAGE_ID,
    path: "/home",
    title: TEXT,
    seo: { description: { bn: "", en: "" }, noIndex: false },
    sections,
  };
  return {
    schemaVersion: SITE_DESIGN_BOUNDS.schemaVersion,
    tokens: sampleTokens(),
    header: chrome("header"),
    footer: chrome("footer"),
    pages: [page],
    staticContent: [],
  };
}

/** The section keys a reader would render, flattened across pages. */
function sectionKeysOf(design: PublishedSiteDesign | SiteDesign): readonly string[] {
  return design.pages.flatMap((page) => page.sections.map((section) => section.sectionKey));
}

describe("collectImageFileIds", () => {
  it("returns every image the document shows", () => {
    const design = sampleDesign([
      hero(SECTION_ID.hero, FILE_A),
      hero(SECTION_ID.secondHero, FILE_B),
    ]);
    expect([...collectImageFileIds(design)].sort()).toEqual([FILE_A, FILE_B].sort());
  });

  it("answers each file once, so a shared image is checked once", () => {
    const design = sampleDesign([
      hero(SECTION_ID.hero, FILE_A),
      hero(SECTION_ID.secondHero, FILE_A),
    ]);
    expect(collectImageFileIds(design)).toEqual([FILE_A]);
  });

  it("ignores sections that show no image", () => {
    const design = sampleDesign([hero(SECTION_ID.hero), moduleSection("offering-grid")]);
    expect(collectImageFileIds(design)).toEqual([]);
  });
});

describe("assertRenderableSchemaVersion", () => {
  it("accepts the version this build renders", () => {
    expect(() => assertRenderableSchemaVersion(SITE_DESIGN_BOUNDS.schemaVersion)).not.toThrow();
  });

  it("refuses an unknown version instead of reading it partially", () => {
    try {
      assertRenderableSchemaVersion(SITE_DESIGN_BOUNDS.schemaVersion + 1);
      throw new Error("expected a schema version refusal");
    } catch (error) {
      expect(error).toBeInstanceOf(DomainRuleError);
      expect(error).toMatchObject({
        code: ERROR_CODE.WEBSITE_DESIGN_INVALID,
        details: { reason: "unsupported_schema_version" },
      });
    }
  });
});

describe("projectPublishedDesign", () => {
  it("keeps the chrome and every section whose module is effective", () => {
    const published = projectPublishedDesign({
      design: sampleDesign([hero(SECTION_ID.hero), moduleSection("directory-list")]),
      effectiveSectionKeys: [...CHROME_KEYS, SECTION_KEY.hero, SECTION_KEY["directory-list"]],
    });
    expect(sectionKeysOf(published)).toEqual([SECTION_KEY.hero, SECTION_KEY["directory-list"]]);
    expect(published.header.sectionKey).toBe(SECTION_KEY.header);
    expect(published.footer.sectionKey).toBe(SECTION_KEY.footer);
  });

  it("drops a section whose module stopped being effective", () => {
    const published = projectPublishedDesign({
      design: sampleDesign([hero(SECTION_ID.hero), moduleSection("offering-grid")]),
      effectiveSectionKeys: [...CHROME_KEYS, SECTION_KEY.hero],
    });
    expect(sectionKeysOf(published)).toEqual([SECTION_KEY.hero]);
  });

  it("publishes only the opted-in static pages, and without the draft flag", () => {
    const design = sampleDesign();
    const published = projectPublishedDesign({
      design: { ...design, staticContent: [aboutPage("PRIVACY", true), aboutPage("ABOUT", false)] },
      effectiveSectionKeys: CHROME_KEYS,
    });
    expect(published.staticContent).toEqual([{ pageKey: "PRIVACY", title: TEXT, body: TEXT }]);
    expect(Object.keys(published.staticContent[0] ?? {})).not.toContain("includeInPublication");
  });

  it("carries the tokens and schema version unchanged", () => {
    const design = sampleDesign();
    const published = projectPublishedDesign({ design, effectiveSectionKeys: CHROME_KEYS });
    expect(published.tokens).toEqual(design.tokens);
    expect(published.schemaVersion).toBe(SITE_DESIGN_BOUNDS.schemaVersion);
  });
});

describe("republishPublishedDesign", () => {
  const EFFECTIVE_KEYS = [
    ...CHROME_KEYS,
    SECTION_KEY.hero,
    SECTION_KEY["offering-grid"],
    SECTION_KEY["directory-list"],
  ];
  const published = projectPublishedDesign({
    design: sampleDesign([
      hero(SECTION_ID.hero),
      moduleSection("offering-grid"),
      moduleSection("directory-list"),
    ]),
    effectiveSectionKeys: EFFECTIVE_KEYS,
  });

  it("re-filters a stored snapshot through what is effective now", () => {
    const reRead = republishPublishedDesign({
      design: published,
      effectiveSectionKeys: [...CHROME_KEYS, SECTION_KEY.hero],
    });
    expect(sectionKeysOf(reRead)).toEqual([SECTION_KEY.hero]);
  });

  it("leaves the snapshot untouched while its modules stay effective", () => {
    const reRead = republishPublishedDesign({
      design: published,
      effectiveSectionKeys: EFFECTIVE_KEYS,
    });
    expect(sectionKeysOf(reRead)).toEqual(sectionKeysOf(published));
  });

  it("keeps the static pages of the snapshot: a projection has no draft flag to read", () => {
    const withPage: PublishedSiteDesign = {
      ...published,
      staticContent: [{ pageKey: "ABOUT", title: TEXT, body: TEXT }],
    };
    const reRead = republishPublishedDesign({
      design: withPage,
      effectiveSectionKeys: CHROME_KEYS,
    });
    expect(reRead.staticContent).toEqual(withPage.staticContent);
  });
});

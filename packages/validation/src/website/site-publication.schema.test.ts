import { describe, expect, it } from "vitest";
import {
  publishedSiteDesignSchema,
  publishSiteRequestSchema,
  restoreSiteRequestSchema,
  siteLayoutPageRequestSchema,
  siteThemeUpdateRequestSchema,
  siteVersionsQuerySchema,
  websiteVersionIdParamsSchema,
} from "./site-publication.schema.js";
import { siteDesignSchema } from "./site-design.schema.js";

const VERSION_ID = "01926b48-1234-7abc-8def-0123456789aa";
const ID_A = "01926b48-1234-7abc-8def-0123456789a1";
const ID_C = "01926b48-1234-7abc-8def-0123456789a3";
const ID_D = "01926b48-1234-7abc-8def-0123456789a4";
const TEXT = { bn: "শিরোনাম", en: "Title" };
const PUBLISHED_ABOUT = { pageKey: "ABOUT", title: TEXT, body: TEXT };

function publishedDesign(staticContent: readonly Record<string, unknown>[] = [PUBLISHED_ABOUT]) {
  const draft = siteDesignSchema.parse(sampleDraft());
  return {
    schemaVersion: draft.schemaVersion,
    tokens: draft.tokens,
    header: draft.header,
    footer: draft.footer,
    pages: draft.pages,
    staticContent,
  };
}

function sampleDraft() {
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
      sectionId: "01926b48-1234-7abc-8def-0123456789a2",
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
            content: { heading: TEXT, body: TEXT },
          },
        ],
      },
    ],
    staticContent: [],
  };
}

describe("publication request schemas", () => {
  it("accepts publish with only the version the editor read", () => {
    expect(publishSiteRequestSchema.safeParse({ expectedVersion: 3 }).success).toBe(true);
  });

  it("refuses a policy or provenance field smuggled into a publish body", () => {
    expect(
      publishSiteRequestSchema.safeParse({
        expectedVersion: 3,
        editPolicy: { regions: [] },
      }).success,
    ).toBe(false);
  });

  it("names the restore snapshot in the path, so the body cannot aim at another version", () => {
    expect(restoreSiteRequestSchema.safeParse({ expectedVersion: 3 }).success).toBe(true);
    expect(
      restoreSiteRequestSchema.safeParse({
        expectedVersion: 3,
        websiteVersionId: VERSION_ID,
      }).success,
    ).toBe(false);
    expect(websiteVersionIdParamsSchema.safeParse({ websiteVersionId: VERSION_ID }).success).toBe(
      true,
    );
    expect(websiteVersionIdParamsSchema.safeParse({ websiteVersionId: "not-an-id" }).success).toBe(
      false,
    );
  });

  it("accepts a full token block for the theme route and nothing else", () => {
    const design = siteDesignSchema.parse(sampleDraft());
    expect(
      siteThemeUpdateRequestSchema.safeParse({ expectedVersion: 1, tokens: design.tokens }).success,
    ).toBe(true);
    expect(
      siteThemeUpdateRequestSchema.safeParse({
        expectedVersion: 1,
        tokens: { color: { ...design.tokens.color, primary: "red" } },
      }).success,
    ).toBe(false);
  });

  it("keeps the page id out of a layout-page body, so the path owns the identity", () => {
    expect(
      siteLayoutPageRequestSchema.safeParse({
        expectedVersion: 1,
        page: {
          path: "/about-us",
          title: TEXT,
          seo: { description: TEXT, noIndex: false },
          sections: [],
        },
      }).success,
    ).toBe(true);
    expect(
      siteLayoutPageRequestSchema.safeParse({
        expectedVersion: 1,
        page: {
          pageId: ID_C,
          path: "/about-us",
          title: TEXT,
          seo: { description: TEXT, noIndex: false },
          sections: [],
        },
      }).success,
    ).toBe(false);
  });

  it("caps the version list at the shared page limit", () => {
    expect(siteVersionsQuerySchema.parse({ page: "2", limit: "50" })).toEqual({
      page: 2,
      limit: 50,
    });
    expect(siteVersionsQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
  });
});

describe("publishedSiteDesignSchema", () => {
  it("reads back a projection whose static pages dropped the draft-only flag", () => {
    expect(publishedSiteDesignSchema.safeParse(publishedDesign()).success).toBe(true);
  });

  it("refuses a snapshot that still carries includeInPublication", () => {
    const leaked = publishedDesign([{ ...PUBLISHED_ABOUT, includeInPublication: true }]);
    expect(publishedSiteDesignSchema.safeParse(leaked).success).toBe(false);
  });

  it("refuses a snapshot of an unknown schema version", () => {
    const future = { ...publishedDesign(), schemaVersion: 2 };
    expect(publishedSiteDesignSchema.safeParse(future).success).toBe(false);
  });
});

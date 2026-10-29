import { SITE_DESIGN_BOUNDS } from "@banijjik/contracts/website";
import { describe, expect, it } from "vitest";
import { siteDesignSchema } from "./site-design.schema.js";

const ID_A = "01926b48-1234-7abc-8def-0123456789a1";
const ID_B = "01926b48-1234-7abc-8def-0123456789a2";
const ID_C = "01926b48-1234-7abc-8def-0123456789a3";
const ID_D = "01926b48-1234-7abc-8def-0123456789a4";
const TEXT = { bn: "শিরোনাম", en: "Title" };

function readableTokens() {
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

function firstSection(design: ReturnType<typeof validDesign>): Record<string, unknown> {
  const value = design.pages[0]?.sections[0];
  if (typeof value !== "object" || value === null) throw new Error("fixture hero missing");
  return { ...(value as Record<string, unknown>) };
}

function chrome(sectionKey: "header" | "footer", sectionId: string) {
  return {
    sectionId,
    sectionKey,
    variantKey: "SIMPLE",
    regionKey: String(sectionKey),
    binding: null,
    content: { links: [{ label: TEXT, path: "/home" }] },
  };
}

function validDesign(): {
  schemaVersion: 1;
  tokens: ReturnType<typeof readableTokens>;
  header: ReturnType<typeof chrome>;
  footer: ReturnType<typeof chrome>;
  pages: {
    pageId: string;
    path: string;
    title: { bn: string; en: string };
    seo: { description: { bn: string; en: string }; noIndex: boolean };
    sections: unknown[];
  }[];
  staticContent: unknown[];
} {
  return {
    schemaVersion: 1,
    tokens: readableTokens(),
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

describe("siteDesignSchema", () => {
  it("accepts a bounded high-contrast design with registered variants", () => {
    const parsed = siteDesignSchema.safeParse(validDesign());
    expect(parsed.success).toBe(true);
  });

  it("accepts known catalog and directory section keys with a binding", () => {
    const design = validDesign();
    const page = design.pages[0];
    if (page === undefined) throw new Error("fixture page missing");
    page.sections = [
      {
        sectionId: ID_D,
        sectionKey: "offering-grid",
        variantKey: "GRID",
        regionKey: "main",
        binding: { limit: 8, offeringIds: [ID_C] },
        content: { heading: TEXT },
      },
    ];
    expect(siteDesignSchema.safeParse(design).success).toBe(true);
  });

  it("rejects unknown enum, section, variant and extra fields", () => {
    const extra = { ...validDesign(), extra: true };
    expect(siteDesignSchema.safeParse(extra).success).toBe(false);
    const design = validDesign();
    const tokens = { ...design.tokens, type: { ...design.tokens.type, scale: "HUGE" } };
    expect(siteDesignSchema.safeParse({ ...design, tokens }).success).toBe(false);
    const hero = design.pages[0]?.sections[0];
    if (hero === undefined) throw new Error("fixture hero missing");
    expect(
      siteDesignSchema.safeParse({
        ...design,
        pages: [{ ...design.pages[0], sections: [{ ...hero, variantKey: "BANNER" }] }],
      }).success,
    ).toBe(false);
  });

  it("rejects oversize JSON instead of truncating", () => {
    const design = validDesign();
    const pad = "x".repeat(SITE_DESIGN_BOUNDS.maxRichTextLength);
    const page = design.pages[0];
    if (page === undefined) throw new Error("fixture page missing");
    page.sections = Array.from({ length: 12 }, (_, index) => ({
      sectionId: `01926b48-1234-7abc-8def-0123456789${(10 + index).toString(16).padStart(2, "0")}`,
      sectionKey: "rich-text" as const,
      variantKey: "STANDARD",
      regionKey: "main",
      binding: null,
      content: { body: { bn: pad, en: pad } },
    }));
    expect(siteDesignSchema.safeParse(design).success).toBe(false);
  });

  it("rejects unsafe URLs, Markdown HTML and CSS injection", () => {
    const design = validDesign();
    const header = {
      ...design.header,
      content: { links: [{ label: TEXT, path: "javascript:alert(1)" }] },
    };
    expect(siteDesignSchema.safeParse({ ...design, header }).success).toBe(false);
    const html = validDesign();
    const hero = firstSection(html);
    const htmlPage = html.pages[0];
    if (htmlPage === undefined) throw new Error("fixture page missing");
    html.pages = [
      {
        ...htmlPage,
        sections: [
          {
            ...hero,
            content: { heading: TEXT, body: { bn: "<b>x</b>", en: "ok" } },
          },
        ],
      },
    ];
    expect(siteDesignSchema.safeParse(html).success).toBe(false);
    const css = validDesign();
    css.header = {
      ...css.header,
      content: { links: [{ label: { bn: "url(https://x)", en: "Home" }, path: "/home" }] },
    };
    expect(siteDesignSchema.safeParse(css).success).toBe(false);
  });

  it("rejects a pale text colour that fails the surface and background pairings", () => {
    const design = validDesign();
    design.tokens = {
      ...design.tokens,
      color: { ...design.tokens.color, text: "#eeeeee" },
    };
    expect(siteDesignSchema.safeParse(design).success).toBe(false);
  });

  it("rejects a reserved application path and a static-page shadow", () => {
    const design = validDesign();
    const page = design.pages[0];
    if (page === undefined) throw new Error("fixture page missing");
    expect(
      siteDesignSchema.safeParse({ ...design, pages: [{ ...page, path: "/pages/about" }] }).success,
    ).toBe(false);
    expect(
      siteDesignSchema.safeParse({ ...design, pages: [{ ...page, path: "/checkout" }] }).success,
    ).toBe(false);
  });

  it("rejects a static section with a binding and a non-v7 image file id", () => {
    const design = validDesign();
    const hero = firstSection(design);
    const page = design.pages[0];
    if (page === undefined) throw new Error("fixture page missing");
    expect(
      siteDesignSchema.safeParse({
        ...design,
        pages: [{ ...page, sections: [{ ...hero, binding: { limit: 4 } }] }],
      }).success,
    ).toBe(false);
    expect(
      siteDesignSchema.safeParse({
        ...design,
        pages: [
          {
            ...page,
            sections: [
              {
                ...hero,
                content: {
                  heading: TEXT,
                  body: TEXT,
                  imageFileId: "3b241101-e2bb-4255-8caf-4136c566a962",
                },
              },
            ],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects a duplicate sectionId and a header whose region is not header", () => {
    const design = validDesign();
    design.footer = { ...design.footer, sectionId: ID_A };
    expect(siteDesignSchema.safeParse(design).success).toBe(false);
    const moved = validDesign();
    moved.header = { ...moved.header, regionKey: "main" };
    expect(siteDesignSchema.safeParse(moved).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { SITE_DESIGN_BOUNDS } from "@banijjik/contracts/website";
import {
  createWebsiteTemplateRequestSchema,
  websiteTemplateContentSchema,
} from "./website-template.schema.js";

const ID_A = "01926b48-1234-7abc-8def-0123456789a1";
const ID_B = "01926b48-1234-7abc-8def-0123456789a2";
const ID_C = "01926b48-1234-7abc-8def-0123456789a3";
const ID_D = "01926b48-1234-7abc-8def-0123456789a4";
const TEXT = { bn: "শিরোনাম", en: "Title" };

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

function section(sectionKey: "header" | "footer", sectionId: string) {
  return {
    sectionId,
    sectionKey,
    variantKey: "SIMPLE",
    regionKey: sectionKey,
    binding: null,
    content: { links: [] },
  };
}

function validContent() {
  const siteTokens = tokens();
  return {
    name: TEXT,
    description: { bn: "সংক্ষিপ্ত বিবরণ", en: "Short description" },
    requiredModules: ["catalog"],
    requiredKinds: ["PRODUCT"],
    defaultPresetKey: "starter",
    presets: [
      {
        presetKey: "starter",
        name: { bn: "শুরু", en: "Starter" },
        tokens: siteTokens,
        sectionVariants: { header: "SIMPLE", hero: "SPLIT" },
      },
    ],
    design: {
      schemaVersion: 1,
      tokens: siteTokens,
      header: section("header", ID_A),
      footer: section("footer", ID_B),
      pages: [
        {
          pageId: ID_C,
          path: "/home",
          title: TEXT,
          seo: { description: TEXT, noIndex: false },
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
    },
    policy: {
      regions: [],
      tokenGroups: { color: false, type: false, shape: false, spacing: false, size: false },
      allowedColors: null,
      allowedVariantsBySection: {},
      pageRules: {
        allowCreate: false,
        allowDelete: false,
        allowReorder: false,
        allowPathChange: false,
        editableMetadataKeys: ["title", "description"],
      },
    },
  };
}

describe("websiteTemplateContentSchema", () => {
  it("accepts a bounded design with valid preset membership and registered variants", () => {
    expect(websiteTemplateContentSchema.safeParse(validContent()).success).toBe(true);
  });

  it("a template key is lower kebab-case and rejects an uppercase or spaced value", () => {
    expect(
      createWebsiteTemplateRequestSchema.safeParse({
        templateKey: "Starter Chrome",
        content: validContent(),
        reason: "seed template",
      }).success,
    ).toBe(false);
  });

  it("a default preset outside the preset list is rejected", () => {
    expect(
      websiteTemplateContentSchema.safeParse({ ...validContent(), defaultPresetKey: "missing" })
        .success,
    ).toBe(false);
  });

  it("a template content keeps the design bounds, contrast pairs and registered variants of 4.1", () => {
    const content = validContent();
    Object.assign(content.design.tokens.color, { text: "#ffffff" });
    expect(websiteTemplateContentSchema.safeParse(content).success).toBe(false);

    const tooManyPages = validContent();
    Object.assign(tooManyPages.design, {
      pages: Array.from({ length: SITE_DESIGN_BOUNDS.maxPages + 1 }, (_, index) => ({
        pageId: `01926b48-1234-7abc-8def-0123456789${index.toString(16).padStart(2, "0")}`,
        path: `/page-${index}`,
        title: TEXT,
        seo: { description: TEXT, noIndex: false },
        sections: [],
      })),
    });
    expect(websiteTemplateContentSchema.safeParse(tooManyPages).success).toBe(false);

    const invalidVariant = validContent();
    const preset = invalidVariant.presets[0];
    if (preset === undefined) throw new Error("fixture preset missing");
    Object.assign(preset.sectionVariants, { hero: "BANNER" });
    expect(websiteTemplateContentSchema.safeParse(invalidVariant).success).toBe(false);

    const invalidDesignVariant = validContent();
    const invalidDesignPage = invalidDesignVariant.design.pages[0];
    if (invalidDesignPage === undefined) throw new Error("fixture page missing");
    const invalidDesignSection = invalidDesignPage.sections[0];
    if (invalidDesignSection === undefined) throw new Error("fixture hero missing");
    Object.assign(invalidDesignSection, { variantKey: "BANNER" });
    expect(websiteTemplateContentSchema.safeParse(invalidDesignVariant).success).toBe(false);
  });

  it("a template content that carries an image file id is rejected", () => {
    const withImage = validContent();
    const page = withImage.design.pages[0];
    if (page === undefined) throw new Error("fixture page missing");
    const hero = page.sections[0];
    if (hero === undefined) throw new Error("fixture hero missing");
    Object.assign(hero.content, { imageFileId: ID_D });
    expect(websiteTemplateContentSchema.safeParse(withImage).success).toBe(false);
  });

  it("required modules and kinds must be registered vocabulary", () => {
    expect(
      websiteTemplateContentSchema.safeParse({ ...validContent(), requiredModules: ["unknown"] })
        .success,
    ).toBe(false);
    expect(
      websiteTemplateContentSchema.safeParse({ ...validContent(), requiredKinds: ["UNKNOWN"] })
        .success,
    ).toBe(false);
  });
});

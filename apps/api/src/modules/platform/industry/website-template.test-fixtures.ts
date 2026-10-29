import { websiteTemplateContentSchema } from "@banijjik/validation/website";
import type { SiteTokens, WebsiteTemplateContent } from "@banijjik/contracts/website";

const TEXT = { bn: "শিরোনাম", en: "Title" };

function tokens(primary = "#15803d"): SiteTokens {
  return {
    color: {
      primary,
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

export function websiteTemplateContent(primary?: string): WebsiteTemplateContent {
  const siteTokens = tokens(primary);
  const content: WebsiteTemplateContent = {
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
    design: design(siteTokens),
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
  websiteTemplateContentSchema.parse(content);
  return content;
}

function design(siteTokens: SiteTokens): WebsiteTemplateContent["design"] {
  const section = (sectionKey: "header" | "footer", sectionId: string) => ({
    sectionId,
    sectionKey,
    variantKey: "SIMPLE",
    regionKey: sectionKey,
    binding: null,
    content: { links: [] },
  });
  return {
    schemaVersion: 1,
    tokens: siteTokens,
    header: section("header", "01926b48-1234-7abc-8def-0123456789a1"),
    footer: section("footer", "01926b48-1234-7abc-8def-0123456789a2"),
    pages: [
      {
        pageId: "01926b48-1234-7abc-8def-0123456789a3",
        path: "/home",
        title: TEXT,
        seo: { description: TEXT, noIndex: false },
        sections: [
          {
            sectionId: "01926b48-1234-7abc-8def-0123456789a4",
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

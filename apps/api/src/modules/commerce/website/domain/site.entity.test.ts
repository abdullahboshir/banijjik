import {
  CONSERVATIVE_PAGE_RULES,
  type SiteDesign,
  type SiteEditPolicy,
} from "@banijjik/contracts/website";
import { asId, newId, type OrganizationId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { Site } from "./site.entity.js";

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

function samplePolicy(): SiteEditPolicy {
  return {
    regions: [],
    tokenGroups: { color: true, type: true, shape: true, spacing: true, size: true },
    allowedColors: null,
    allowedVariantsBySection: {},
    pageRules: CONSERVATIVE_PAGE_RULES,
  };
}

function createSite(design: SiteDesign): Site {
  return Site.create({
    organizationId: asId<OrganizationId>(newId()),
    draftDesign: design,
    editPolicy: samplePolicy(),
    sourceTemplateKey: "retail-starter",
    sourceTemplateRevision: 3,
    now: new Date("2026-10-28T00:00:00.000Z"),
    actorUserId: asId<UserId>(newId()),
  });
}

describe("Site", () => {
  it("copies from one template keep changing independently", () => {
    const template = sampleDesign();
    const first = createSite(template);
    const second = createSite(template);
    const home = first.draftDesign.pages[0];
    if (home === undefined) throw new Error("fixture page missing");
    const edited: SiteDesign = {
      ...first.draftDesign,
      pages: [{ ...home, title: { bn: "নতুন", en: "New" } }],
    };

    const savedFirst = first.replaceDraft({
      draftDesign: edited,
      now: new Date("2026-10-28T01:00:00.000Z"),
      actorUserId: first.createdByUserId,
    });

    expect(savedFirst.draftDesign.pages[0]?.title.en).toBe("New");
    expect(second.draftDesign.pages[0]?.title.en).toBe("Title");
    expect(first.siteId).not.toBe(second.siteId);
    expect(savedFirst.version).toBe(2);
    expect(second.version).toBe(1);
  });
});

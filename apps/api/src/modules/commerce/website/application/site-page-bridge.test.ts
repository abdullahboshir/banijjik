import {
  PAGE_PUBLICATION_STATE,
  type SiteDesign,
  type SiteSection,
} from "@banijjik/contracts/website";
import { describe, expect, it } from "vitest";
import {
  importLegacyStaticPages,
  publicationStateOf,
  replaceStaticPage,
} from "./site-page-bridge.js";

const ID_A = "01926b48-1234-7abc-8def-0123456789a1";
const ID_B = "01926b48-1234-7abc-8def-0123456789a2";
const TEXT = { bn: "শিরোনাম", en: "Title" };

function chrome(sectionKey: "header" | "footer"): SiteSection {
  return {
    sectionId: sectionKey === "header" ? ID_A : ID_B,
    sectionKey,
    variantKey: "SIMPLE",
    regionKey: sectionKey,
    binding: null,
    content: { links: [{ label: TEXT, path: "/home" }] },
  };
}

function emptyDesign(): SiteDesign {
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
    header: chrome("header"),
    footer: chrome("footer"),
    pages: [],
    staticContent: [],
  };
}

describe("site page bridge", () => {
  it("imports each legacy page once and leaves an already-copied key unchanged", () => {
    const first = importLegacyStaticPages(emptyDesign(), [
      {
        pageKey: "ABOUT",
        title: { bn: "", en: "Legacy" },
        body: { bn: "", en: "Old" },
        isPublished: true,
      },
    ]);
    expect(first.staticContent).toEqual([
      {
        pageKey: "ABOUT",
        title: { bn: "", en: "Legacy" },
        body: { bn: "", en: "Old" },
        includeInPublication: true,
      },
    ]);

    const edited = replaceStaticPage(first, {
      pageKey: "ABOUT",
      title: { bn: "", en: "Draft" },
      body: { bn: "", en: "New" },
      includeInPublication: false,
    });
    const again = importLegacyStaticPages(edited, [
      {
        pageKey: "ABOUT",
        title: { bn: "", en: "Legacy" },
        body: { bn: "", en: "Old" },
        isPublished: true,
      },
    ]);
    expect(again.staticContent).toEqual(edited.staticContent);
  });

  it("names LEGACY, DRAFT and PUBLISHED from whether a Site exists and has published", () => {
    expect(publicationStateOf({ hasSite: false, hasPublishedOnce: false })).toBe(
      PAGE_PUBLICATION_STATE.LEGACY,
    );
    expect(publicationStateOf({ hasSite: true, hasPublishedOnce: false })).toBe(
      PAGE_PUBLICATION_STATE.DRAFT,
    );
    expect(publicationStateOf({ hasSite: true, hasPublishedOnce: true })).toBe(
      PAGE_PUBLICATION_STATE.PUBLISHED,
    );
  });
});

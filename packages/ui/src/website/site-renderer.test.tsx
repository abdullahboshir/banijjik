import { STATIC_SECTION_KEYS, type SiteDesign } from "@banijjik/contracts/website";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteRenderer } from "./site-renderer.js";

const HEADER_ID = "01926b48-1234-7abc-8def-0123456789a1";
const FOOTER_ID = "01926b48-1234-7abc-8def-0123456789a2";
const PAGE_ID = "01926b48-1234-7abc-8def-0123456789a3";
const HERO_ID = "01926b48-1234-7abc-8def-0123456789a4";
const IMAGE_ID = "01926b48-1234-7abc-8def-0123456789a5";
const GRID_ID = "01926b48-1234-7abc-8def-0123456789a6";
const FAQ_ID = "01926b48-1234-7abc-8def-0123456789a7";

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
      sectionId: HEADER_ID,
      sectionKey: "header",
      variantKey: "SIMPLE",
      regionKey: "header",
      binding: null,
      content: { links: [{ label: { bn: "হোম", en: "Home" }, path: "/home" }] },
    },
    footer: {
      sectionId: FOOTER_ID,
      sectionKey: "footer",
      variantKey: "SIMPLE",
      regionKey: "footer",
      binding: null,
      content: { links: [{ label: { bn: "যোগাযোগ", en: "Contact" }, path: "/pages/about" }] },
    },
    pages: [
      {
        pageId: PAGE_ID,
        path: "/home",
        title: { bn: "স্বাগতম পাতা", en: "Welcome page" },
        seo: { description: { bn: "", en: "" }, noIndex: false },
        sections: [
          {
            sectionId: HERO_ID,
            sectionKey: "hero",
            variantKey: "SPLIT",
            regionKey: "main",
            binding: null,
            content: {
              heading: { bn: "স্বাগতম আমাদের সেলুনে", en: "Welcome to our salon" },
              body: { bn: "আমরা **যত্ন** করি।", en: "We care." },
              imageFileId: IMAGE_ID,
              actionLabel: { bn: "বুক করুন", en: "Book now" },
              actionPath: "/pages/about",
            },
          },
          {
            sectionId: GRID_ID,
            sectionKey: "offering-grid",
            variantKey: "GRID",
            regionKey: "main",
            binding: { limit: 8 },
            content: { heading: { bn: "সেবা", en: "Services" } },
          },
          {
            sectionId: FAQ_ID,
            sectionKey: "faq",
            variantKey: "ACCORDION",
            regionKey: "main",
            binding: null,
            content: {
              entries: [
                {
                  question: { bn: "সময়?", en: "Hours?" },
                  answer: { bn: "সকাল ১০টা", en: "10am" },
                },
              ],
            },
          },
        ],
      },
    ],
    staticContent: [],
  };
}

describe("SiteRenderer", () => {
  it("renders static sections in Bengali with wrapping classes and accessible names", () => {
    render(
      <div style={{ width: 360 }}>
        <SiteRenderer
          design={sampleDesign()}
          locale="bn"
          effectiveSectionKeys={[...STATIC_SECTION_KEYS]}
        />
      </div>,
    );

    const heading = screen.getByRole("heading", { name: "স্বাগতম আমাদের সেলুনে" });
    expect(heading.className).toContain("break-words");
    expect(screen.getByRole("link", { name: "বুক করুন" }).getAttribute("href")).toBe(
      "/pages/about",
    );
    expect(screen.getByRole("link", { name: "হোম" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "স্বাগতম আমাদের সেলুনে" }).getAttribute("src")).toBe(
      `/api/v1/public/files/${IMAGE_ID}/medium`,
    );
    expect(screen.getByText("সময়?")).toBeTruthy();
    expect(screen.queryByText("সেবা")).toBeNull();
  });

  it("hides a section whose module is not in effectiveSectionKeys even when the snapshot still has it", () => {
    render(
      <SiteRenderer
        design={sampleDesign()}
        locale="en"
        effectiveSectionKeys={["header", "footer", "faq"]}
      />,
    );

    expect(screen.queryByRole("heading", { name: "Welcome to our salon" })).toBeNull();
    expect(screen.getByText("Hours?")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Home" })).toBeTruthy();
  });

  it("refuses javascript links, raw HTML and a non-v7 image id", () => {
    const design = sampleDesign();
    const page = design.pages[0];
    if (page === undefined) throw new Error("fixture page missing");
    const poisoned: SiteDesign = {
      ...design,
      header: {
        sectionId: HEADER_ID,
        sectionKey: "header",
        variantKey: "SIMPLE",
        regionKey: "header",
        binding: null,
        content: {
          links: [{ label: { bn: "খারাপ", en: "Bad" }, path: "javascript:alert(1)" }],
        },
      },
      pages: [
        {
          ...page,
          sections: [
            {
              sectionId: HERO_ID,
              sectionKey: "hero",
              variantKey: "CENTERED",
              regionKey: "main",
              binding: null,
              content: {
                heading: { bn: "<em>হ্যালো</em>", en: "<em>Hello</em>" },
                body: { bn: "<script>alert(1)</script>", en: "<script>alert(1)</script>" },
                imageFileId: "not-a-uuid",
                actionPath: "javascript:alert(1)",
                actionLabel: { bn: "যাবেন না", en: "Do not go" },
              },
            },
          ],
        },
      ],
    };

    const { container } = render(
      <SiteRenderer
        design={poisoned}
        locale="bn"
        effectiveSectionKeys={[...STATIC_SECTION_KEYS]}
      />,
    );

    expect(screen.queryByRole("link", { name: "খারাপ" })).toBeNull();
    expect(screen.queryByRole("link", { name: "যাবেন না" })).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.innerHTML).toContain("&lt;script&gt;");
    expect(container.innerHTML).not.toContain("<script>");
  });
});

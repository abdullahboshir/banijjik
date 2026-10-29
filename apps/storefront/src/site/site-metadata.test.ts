import { describe, expect, it } from "vitest";
import {
  ROBOTS_DISALLOWED_PATHS,
  buildCanonicalUrl,
  buildLayoutMetadata,
  buildPageMetadata,
  buildRobotsMetadata,
  buildSitemap,
  normalizeCanonicalPath,
  resolveLocalizedText,
} from "./site-metadata";

const CANONICAL_HOST = "rahim-bibaho.example.com";

describe("site metadata and localized text resolution", () => {
  it("resolves localized title and description from LocalizedText for bn and en", () => {
    const text = {
      bn: "আমাদের সম্পর্কে",
      en: "About us",
    };

    expect(resolveLocalizedText(text, "bn")).toBe("আমাদের সম্পর্কে");
    expect(resolveLocalizedText(text, "en")).toBe("About us");
    expect(resolveLocalizedText(undefined, "bn", "ডিফল্ট")).toBe("ডিফল্ট");
  });

  it("normalizes paths and strips query strings, hashes, duplicate and trailing slashes", () => {
    expect(normalizeCanonicalPath("/")).toBe("/");
    expect(normalizeCanonicalPath("/about/")).toBe("/about");
    expect(normalizeCanonicalPath("about")).toBe("/about");
    expect(normalizeCanonicalPath("/pages//about///")).toBe("/pages/about");
    expect(normalizeCanonicalPath("/search?q=test&page=2#top")).toBe("/search");
  });

  it("builds canonical URLs strictly from the trusted registry canonicalHostname and normalized path", () => {
    const canonical = buildCanonicalUrl(CANONICAL_HOST, "/pages/about?poison=1#hash");
    expect(canonical).toBe("https://rahim-bibaho.example.com/pages/about");
  });

  it("emits noindex/nofollow and no canonical link for unknown hosts", () => {
    const layout = buildLayoutMetadata({ canonicalHostname: undefined });
    expect(layout.robots).toEqual({ index: false, follow: false });
    expect(layout.alternates).toBeUndefined();

    const page = buildPageMetadata({
      canonicalHostname: undefined,
      title: "Page",
      path: "/about",
    });
    expect(page.robots).toEqual({ index: false, follow: false });
    expect(page.alternates).toBeUndefined();
  });

  it("builds trusted layout and page metadata with canonical link when host is resolved", () => {
    const layout = buildLayoutMetadata({
      canonicalHostname: CANONICAL_HOST,
      title: "Store Title",
    });
    expect(layout.metadataBase?.toString()).toBe("https://rahim-bibaho.example.com/");
    expect(layout.alternates?.canonical).toBe("https://rahim-bibaho.example.com/");
    expect(layout.robots).toBeUndefined();

    const page = buildPageMetadata({
      canonicalHostname: CANONICAL_HOST,
      title: "About us",
      path: "/pages/about",
    });
    expect(page.title).toBe("About us");
    expect(page.alternates?.canonical).toBe("https://rahim-bibaho.example.com/pages/about");
  });
});

describe("robots.txt and sitemap.xml rules", () => {
  it("disallows all crawling for unknown hosts in robots", () => {
    const robots = buildRobotsMetadata(undefined);
    expect(robots.rules).toEqual({ userAgent: "*", disallow: "/" });
    expect(robots.sitemap).toBeUndefined();
  });

  it("allows / and disallows private endpoints with canonical sitemap URL for resolved hosts", () => {
    const robots = buildRobotsMetadata(CANONICAL_HOST);
    expect(robots.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: [...ROBOTS_DISALLOWED_PATHS],
    });
    expect(robots.sitemap).toBe("https://rahim-bibaho.example.com/sitemap.xml");

    // Explicitly verify private and customer paths are disallowed
    expect(ROBOTS_DISALLOWED_PATHS).toContain("/api/");
    expect(ROBOTS_DISALLOWED_PATHS).toContain("/sign-in");
    expect(ROBOTS_DISALLOWED_PATHS).toContain("/my/");
    expect(ROBOTS_DISALLOWED_PATHS).toContain("/preview");
    expect(ROBOTS_DISALLOWED_PATHS).toContain("/cart");
    expect(ROBOTS_DISALLOWED_PATHS).toContain("/checkout");
  });

  it("sitemap includes published public pages, /search when directory is on, and excludes private paths", () => {
    const sitemap = buildSitemap({
      canonicalHostname: CANONICAL_HOST,
      directoryEnabled: true,
      pages: [{ pageKey: "ABOUT" }, { pageKey: "TERMS" }],
    });

    const urls = sitemap.map((item) => item.url);

    expect(urls).toContain("https://rahim-bibaho.example.com/");
    expect(urls).toContain("https://rahim-bibaho.example.com/search");
    expect(urls).toContain("https://rahim-bibaho.example.com/pages/about");
    expect(urls).toContain("https://rahim-bibaho.example.com/pages/terms");

    // Excludes private paths and listing details
    for (const url of urls) {
      expect(url).not.toContain("/listings/");
      expect(url).not.toContain("/sign-in");
      expect(url).not.toContain("/my/");
      expect(url).not.toContain("/preview");
      expect(url).not.toContain("/cart");
      expect(url).not.toContain("/checkout");
    }
  });

  it("sitemap excludes /search when directory feature is disabled", () => {
    const sitemap = buildSitemap({
      canonicalHostname: CANONICAL_HOST,
      directoryEnabled: false,
      pages: [{ pageKey: "ABOUT" }],
    });

    const urls = sitemap.map((item) => item.url);
    expect(urls).toContain("https://rahim-bibaho.example.com/");
    expect(urls).toContain("https://rahim-bibaho.example.com/pages/about");
    expect(urls).not.toContain("https://rahim-bibaho.example.com/search");
  });
});

import type { Metadata, MetadataRoute } from "next";
import type { LocalizedText } from "@banijjik/contracts";
import type { SitePageKey } from "@banijjik/contracts/website";
import { brandName } from "../config/environment";
import { localizedText } from "../i18n/localized-text";
import { PAGE_PATH_PREFIX, slugOfPageKey } from "../static-pages/page-routes";

export const ROBOTS_DISALLOWED_PATHS = [
  "/api/",
  "/sign-in",
  "/my/",
  "/preview",
  "/cart",
  "/checkout",
] as const;

/**
 * Normalizes a URL path to ensure leading slash, no query/hash,
 * no trailing slash (except root "/"), and no duplicate slashes.
 */
export function normalizeCanonicalPath(path: string): string {
  const withoutQuery = path.split("?")[0]?.split("#")[0] ?? "/";
  let normalized = withoutQuery.trim().replace(/\/+/g, "/");
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/** Constructs a canonical URL using strictly the trusted canonicalHostname and normalized path. */
export function buildCanonicalUrl(canonicalHostname: string, path: string): string {
  const normalized = normalizeCanonicalPath(path);
  return `https://${canonicalHostname}${normalized}`;
}

export function resolveLocalizedText(
  text: LocalizedText | string | undefined,
  locale: string,
  fallback = "",
): string {
  if (text === undefined || text === null) return fallback;
  if (typeof text === "string") return text;
  return localizedText(text, locale as "bn" | "en") || fallback;
}

export interface LayoutMetadataInput {
  readonly canonicalHostname: string | undefined;
  readonly title?: string;
  readonly description?: string;
  readonly locale?: string;
}

/** Layout metadata: unknown hosts receive noindex/nofollow; resolved hosts receive canonical metadataBase. */
export function buildLayoutMetadata(input: LayoutMetadataInput): Metadata {
  const title = input.title ?? brandName();
  if (input.canonicalHostname === undefined) {
    return {
      title,
      description: input.description,
      robots: { index: false, follow: false },
    };
  }

  const canonicalUrl = buildCanonicalUrl(input.canonicalHostname, "/");
  return {
    metadataBase: new URL(`https://${input.canonicalHostname}`),
    title,
    description: input.description,
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export interface PageMetadataInput {
  readonly canonicalHostname: string | undefined;
  readonly title: string;
  readonly description?: string;
  readonly path: string;
  readonly locale?: string;
}

/** Page metadata: constructs canonical URL only from the trusted canonicalHostname and path. */
export function buildPageMetadata(input: PageMetadataInput): Metadata {
  if (input.canonicalHostname === undefined) {
    return {
      title: input.title,
      description: input.description,
      robots: { index: false, follow: false },
    };
  }

  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: buildCanonicalUrl(input.canonicalHostname, input.path),
    },
  };
}

/** Robots.txt rules: disallow all for unknown hosts; allow / and disallow private routes for resolved hosts. */
export function buildRobotsMetadata(canonicalHostname: string | undefined): MetadataRoute.Robots {
  if (canonicalHostname === undefined) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...ROBOTS_DISALLOWED_PATHS],
    },
    sitemap: `https://${canonicalHostname}/sitemap.xml`,
  };
}

export interface SitemapPageItem {
  readonly pageKey: SitePageKey;
}

export interface SitemapInput {
  readonly canonicalHostname: string;
  readonly pages?: readonly SitemapPageItem[] | undefined;
  readonly directoryEnabled?: boolean | undefined;
}

/** Sitemap.xml entries: includes /, /search (if enabled), and published pages only. Excludes private routes. */
export function buildSitemap(input: SitemapInput): MetadataRoute.Sitemap {
  const { canonicalHostname, pages = [], directoryEnabled = false } = input;
  const items: MetadataRoute.Sitemap = [{ url: buildCanonicalUrl(canonicalHostname, "/") }];

  if (directoryEnabled) {
    items.push({ url: buildCanonicalUrl(canonicalHostname, "/search") });
  }

  for (const page of pages) {
    items.push({
      url: buildCanonicalUrl(
        canonicalHostname,
        `${PAGE_PATH_PREFIX}/${slugOfPageKey(page.pageKey)}`,
      ),
    });
  }

  return items;
}

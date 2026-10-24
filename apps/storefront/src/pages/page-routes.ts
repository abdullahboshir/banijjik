import { SITE_PAGE_KEY, type SitePageKey } from "@banijjik/contracts/website";

/** Static pages live under `/pages/<slug>`, where the slug is the page key in lower case. */
export const PAGE_PATH_PREFIX = "/pages";

export function slugOfPageKey(pageKey: SitePageKey): string {
  return pageKey.toLowerCase();
}

/** The page key a URL slug names, or undefined for any other slug. */
export function pageKeyOfSlug(slug: string): SitePageKey | undefined {
  const candidate = slug.toUpperCase();
  return (Object.values(SITE_PAGE_KEY) as readonly string[]).includes(candidate)
    ? (candidate as SitePageKey)
    : undefined;
}

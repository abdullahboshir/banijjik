import {
  SITE_PAGE_KEY,
  type SitePageKey,
  type SitePageResponse,
  type StorefrontSitePageResponse,
  type StorefrontSitePageSummary,
} from "@banijjik/contracts/website";
import type { SitePage } from "../domain/site-page.entity.js";

const EMPTY_TEXT = { bn: "", en: "" } as const;

/** A page that was never saved reads as an empty, unpublished page with version 0 (M.6a decision 1). */
export function blankSitePageResponse(pageKey: SitePageKey): SitePageResponse {
  return {
    pageKey,
    title: EMPTY_TEXT,
    body: EMPTY_TEXT,
    isPublished: false,
    version: 0,
    updatedAt: null,
  };
}

export function toSitePageResponse(page: SitePage): SitePageResponse {
  return {
    pageKey: page.pageKey,
    title: page.title,
    body: page.body,
    isPublished: page.isPublished,
    version: page.version,
    updatedAt: page.updatedAt.toISOString(),
  };
}

export function toStorefrontSitePage(page: SitePage): StorefrontSitePageResponse {
  return { pageKey: page.pageKey, title: page.title, body: page.body };
}

export function toStorefrontSitePageSummary(page: SitePage): StorefrontSitePageSummary {
  return { pageKey: page.pageKey, title: page.title };
}

/** Contract order of the page keys, so the menu order never depends on the database. */
export function sitePageKeyOrder(pageKey: SitePageKey): number {
  return Object.values(SITE_PAGE_KEY).indexOf(pageKey);
}

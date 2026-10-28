import {
  PAGE_PUBLICATION_STATE,
  SITE_PAGE_KEY,
  type LocalizedText,
  type PagePublicationState,
  type SiteDesign,
  type SitePageKey,
  type StaticPageDraft,
  type StorefrontSitePageResponse,
} from "@banijjik/contracts/website";
import { EMPTY_SITE_PAGE_TEXT } from "./site-page-views.js";
import type { SiteRepository } from "./ports/site-repository.js";
import type { WebsiteVersionReader } from "./ports/website-version-reader.js";

export interface LegacyPageCopy {
  readonly pageKey: SitePageKey;
  readonly title: LocalizedText;
  readonly body: LocalizedText;
  readonly isPublished: boolean;
}

export function publicationStateOf(input: {
  readonly hasSite: boolean;
  readonly hasPublishedOnce: boolean;
}): PagePublicationState {
  if (!input.hasSite) return PAGE_PUBLICATION_STATE.LEGACY;
  return input.hasPublishedOnce ? PAGE_PUBLICATION_STATE.PUBLISHED : PAGE_PUBLICATION_STATE.DRAFT;
}

export function blankStaticDraft(pageKey: SitePageKey): StaticPageDraft {
  return {
    pageKey,
    title: EMPTY_SITE_PAGE_TEXT,
    body: EMPTY_SITE_PAGE_TEXT,
    includeInPublication: false,
  };
}

export function findStaticPage(
  design: SiteDesign,
  pageKey: SitePageKey,
): StaticPageDraft | undefined {
  return design.staticContent.find((page) => page.pageKey === pageKey);
}

/** Copy each legacy row into staticContent once. Keys already on the draft stay as they are. */
export function importLegacyStaticPages(
  design: SiteDesign,
  legacyPages: readonly LegacyPageCopy[],
): SiteDesign {
  const present = new Set(design.staticContent.map((page) => page.pageKey));
  const imported: StaticPageDraft[] = [];
  for (const page of legacyPages) {
    if (present.has(page.pageKey)) continue;
    imported.push({
      pageKey: page.pageKey,
      title: page.title,
      body: page.body,
      includeInPublication: page.isPublished,
    });
  }
  if (imported.length === 0) return design;
  return { ...design, staticContent: [...design.staticContent, ...imported] };
}

export function replaceStaticPage(design: SiteDesign, page: StaticPageDraft): SiteDesign {
  const without = design.staticContent.filter((existing) => existing.pageKey !== page.pageKey);
  return { ...design, staticContent: [...without, page] };
}

export function sectionKeysOf(design: SiteDesign): string[] {
  const keys = new Set<string>([design.header.sectionKey, design.footer.sectionKey]);
  for (const page of design.pages) {
    for (const section of page.sections) keys.add(section.sectionKey);
  }
  return [...keys];
}

/**
 * After the first whole-site publish, public reads come from the snapshot only.
 * `undefined` means the frozen legacy pages are still the public source.
 */
export async function snapshotPagesIfPublished(
  sites: SiteRepository,
  versions: WebsiteVersionReader,
): Promise<readonly StorefrontSitePageResponse[] | undefined> {
  const site = await sites.findCurrent();
  if (site === undefined || !site.hasPublishedOnce) return undefined;
  const websiteVersionId = site.publishedWebsiteVersionId;
  if (websiteVersionId === null) return [];
  return (await versions.findStaticPages(websiteVersionId)) ?? [];
}

export function summariesFromSnapshot(
  pages: readonly StorefrontSitePageResponse[],
): { pageKey: SitePageKey; title: StorefrontSitePageResponse["title"] }[] {
  const order = Object.values(SITE_PAGE_KEY);
  return [...pages]
    .sort((left, right) => order.indexOf(left.pageKey) - order.indexOf(right.pageKey))
    .map((page) => ({ pageKey: page.pageKey, title: page.title }));
}

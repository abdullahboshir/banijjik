import { ERROR_CODE, DomainRuleError } from "@banijjik/contracts";
import {
  isSupportedSiteSchemaVersion,
  SECTION_KEY,
  type PublishedSiteDesign,
  type SiteDesign,
  type SiteSection,
  type StaticPageDraft,
  type StorefrontSitePageResponse,
} from "@banijjik/contracts/website";

/** What both a draft and a published snapshot offer: chrome plus pages of sections. */
interface DesignOfSections {
  readonly header: SiteSection;
  readonly footer: SiteSection;
  readonly pages: readonly { readonly sections: readonly SiteSection[] }[];
}

function sectionsOf(design: DesignOfSections): readonly SiteSection[] {
  return [design.header, design.footer, ...design.pages.flatMap((page) => [...page.sections])];
}

function imageFileIdOf(section: SiteSection): string | null {
  const content = section.content;
  if (!("imageFileId" in content)) return null;
  return content.imageFileId ?? null;
}

/**
 * Every image the document shows, without duplicates. The publish command checks these references
 * before it writes, so a snapshot can never point at another organization's file (P4-12).
 */
export function collectImageFileIds(design: DesignOfSections): readonly string[] {
  const ids = new Set<string>();
  for (const section of sectionsOf(design)) {
    const fileId = imageFileIdOf(section);
    if (fileId !== null) ids.add(fileId);
  }
  return [...ids];
}

/** A site of a schema version this build cannot render is refused, never read partially. */
export function assertRenderableSchemaVersion(schemaVersion: number): void {
  if (isSupportedSiteSchemaVersion(schemaVersion)) return;
  throw new DomainRuleError({
    code: ERROR_CODE.WEBSITE_DESIGN_INVALID,
    details: { reason: "unsupported_schema_version" },
  });
}

function toPublishedStaticPage(page: StaticPageDraft): StorefrontSitePageResponse {
  return { pageKey: page.pageKey, title: page.title, body: page.body };
}

function isAllowed(section: SiteSection, effectiveSectionKeys: readonly string[]): boolean {
  // Header and footer belong to the website module itself: the gate that serves this DTO already
  // decided the site exists, and a page without chrome is not a publishable design (decision 10).
  if (section.sectionKey === SECTION_KEY.header || section.sectionKey === SECTION_KEY.footer) {
    return true;
  }
  return effectiveSectionKeys.includes(section.sectionKey);
}

/**
 * The one public projection (card 4.1 Data). It drops the draft-only publication flags and every
 * section whose module is not effective now, so an old snapshot cannot leak a disabled module.
 */
export function projectPublishedDesign(input: {
  readonly design: SiteDesign;
  readonly effectiveSectionKeys: readonly string[];
}): PublishedSiteDesign {
  return {
    schemaVersion: input.design.schemaVersion,
    tokens: input.design.tokens,
    header: input.design.header,
    footer: input.design.footer,
    pages: input.design.pages.map((page) => ({
      ...page,
      sections: page.sections.filter((section) => isAllowed(section, input.effectiveSectionKeys)),
    })),
    staticContent: input.design.staticContent
      .filter((page) => page.includeInPublication)
      .map(toPublishedStaticPage),
  };
}

/** Re-projection of a stored snapshot through the sections that are effective now (P4-12). */
export function republishPublishedDesign(input: {
  readonly design: PublishedSiteDesign;
  readonly effectiveSectionKeys: readonly string[];
}): PublishedSiteDesign {
  return {
    ...input.design,
    pages: input.design.pages.map((page) => ({
      ...page,
      sections: page.sections.filter((section) => isAllowed(section, input.effectiveSectionKeys)),
    })),
  };
}

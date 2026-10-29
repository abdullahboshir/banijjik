import {
  CONSERVATIVE_PAGE_RULES,
  SITE_PAGE_KEY,
  STATIC_CONTENT_REGION_PREFIX,
  type SiteDesign,
  type SiteEditPolicy,
  type SitePage,
  type SitePageKey,
  type SiteSection,
  type SiteTokens,
  type StaticPageDraft,
} from "@banijjik/contracts/website";
import { asId, newId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { SiteRepository } from "../modules/commerce/website/application/ports/site-repository.js";
import { Site } from "../modules/commerce/website/domain/site.entity.js";

/** Ids of the one fixture document, so a test can name the part it changed. */
export const SITE_ID = {
  header: "01926b48-1234-7abc-8def-0123456789a1",
  footer: "01926b48-1234-7abc-8def-0123456789a2",
  page: "01926b48-1234-7abc-8def-0123456789a3",
  hero: "01926b48-1234-7abc-8def-0123456789a4",
  grid: "01926b48-1234-7abc-8def-0123456789a5",
  directory: "01926b48-1234-7abc-8def-0123456789a6",
  secondHero: "01926b48-1234-7abc-8def-0123456789a7",
} as const;

export const SITE_TEST_TEXT = { bn: "শিরোনাম", en: "Title" };

export function siteTokens(): SiteTokens {
  return {
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
  };
}

export function siteChrome(sectionKey: "header" | "footer", path = "/home"): SiteSection {
  return {
    sectionId: sectionKey === "header" ? SITE_ID.header : SITE_ID.footer,
    sectionKey,
    variantKey: "SIMPLE",
    regionKey: sectionKey,
    binding: null,
    content: { links: [{ label: SITE_TEST_TEXT, path }] },
  };
}

export function siteHero(imageFileId?: string, sectionId: string = SITE_ID.hero): SiteSection {
  return {
    sectionId,
    sectionKey: "hero",
    variantKey: "SPLIT",
    regionKey: "main",
    binding: null,
    content:
      imageFileId === undefined
        ? { heading: SITE_TEST_TEXT, body: SITE_TEST_TEXT }
        : { heading: SITE_TEST_TEXT, body: SITE_TEST_TEXT, imageFileId },
  };
}

export function siteOfferingGrid(): SiteSection {
  return {
    sectionId: SITE_ID.grid,
    sectionKey: "offering-grid",
    variantKey: "GRID",
    regionKey: "main",
    binding: null,
    content: { heading: SITE_TEST_TEXT },
  };
}

/**
 * A section of a module the business may or may not hold. It carries a binding because a dynamic
 * section must, so a document naming it stays a schema-valid draft when stored.
 */
export function siteDirectoryList(sectionId: string = SITE_ID.directory): SiteSection {
  return {
    sectionId,
    sectionKey: "directory-list",
    variantKey: "GRID",
    regionKey: "main",
    binding: { limit: 8 },
    content: { heading: SITE_TEST_TEXT },
  };
}

/** The body of `POST /layout-pages`: one page, and its id is the server's to mint. */
export function newSitePage(path: string, sectionId: string): Omit<SitePage, "pageId"> {
  return {
    path,
    title: SITE_TEST_TEXT,
    seo: { description: SITE_TEST_TEXT, noIndex: false },
    sections: [siteHero(undefined, sectionId)],
  };
}

export function siteStaticPage(
  pageKey: SitePageKey = SITE_PAGE_KEY.ABOUT,
  includeInPublication = true,
): StaticPageDraft {
  return { pageKey, title: SITE_TEST_TEXT, body: SITE_TEST_TEXT, includeInPublication };
}

export interface SiteDesignOverrides {
  readonly sections?: readonly SiteSection[];
  readonly staticContent?: readonly StaticPageDraft[];
  readonly header?: SiteSection;
  readonly footer?: SiteSection;
  readonly pages?: readonly SitePage[];
}

/** One whole draft document, with a single page and no static content unless the test asks. */
export function siteDesign(overrides: SiteDesignOverrides = {}): SiteDesign {
  const pages: readonly SitePage[] = overrides.pages ?? [
    {
      pageId: SITE_ID.page,
      path: "/home",
      title: SITE_TEST_TEXT,
      seo: { description: SITE_TEST_TEXT, noIndex: false },
      sections: overrides.sections ?? [siteHero()],
    },
  ];
  return {
    schemaVersion: 1,
    tokens: siteTokens(),
    header: overrides.header ?? siteChrome("header"),
    footer: overrides.footer ?? siteChrome("footer"),
    pages,
    staticContent: overrides.staticContent ?? [],
  };
}

/**
 * The widest policy a tenant can hold: only the header stays locked, so a test that expects a denial
 * names the rule it installed rather than a rule the fixture happens to forbid.
 */
export function permissivePolicy(): SiteEditPolicy {
  return {
    regions: [
      {
        regionKey: "header",
        lock: "LOCKED",
        required: true,
        sectionKeys: ["header"],
        maxSections: 1,
        editableContentKeys: [],
      },
      {
        regionKey: "footer",
        lock: "FULL",
        required: true,
        sectionKeys: ["footer"],
        maxSections: 1,
        editableContentKeys: ["links"],
      },
      {
        regionKey: "main",
        lock: "FULL",
        required: false,
        sectionKeys: ["hero", "rich-text", "offering-grid", "directory-list"],
        maxSections: 5,
        editableContentKeys: [],
      },
      ...Object.values(SITE_PAGE_KEY).map((pageKey) => ({
        regionKey: `${STATIC_CONTENT_REGION_PREFIX}${pageKey}`,
        lock: "FULL" as const,
        required: false,
        sectionKeys: [],
        maxSections: 1,
        editableContentKeys: ["title", "body"],
      })),
    ],
    tokenGroups: { color: true, type: true, shape: true, spacing: true, size: true },
    allowedColors: null,
    allowedVariantsBySection: {
      header: ["SIMPLE"],
      footer: ["SIMPLE", "COLUMNS"],
      hero: ["SPLIT", "CENTERED"],
      "rich-text": ["STANDARD"],
      "offering-grid": ["GRID"],
      "directory-list": ["GRID"],
    },
    pageRules: CONSERVATIVE_PAGE_RULES,
  };
}

export class InMemorySiteRepository implements SiteRepository {
  site: Site | undefined;
  readonly savedVersions: number[] = [];

  async findCurrent(): Promise<Site | undefined> {
    return this.site;
  }

  async insert(site: Site): Promise<"inserted" | "duplicate"> {
    if (this.site !== undefined) return "duplicate";
    this.site = site;
    return "inserted";
  }

  async save(site: Site, expectedVersion: number): Promise<void> {
    if (this.site === undefined || this.site.version !== expectedVersion) {
      throw new Error("stale version");
    }
    this.savedVersions.push(expectedVersion);
    this.site = site;
  }
}

/** A site that has never been published, unless the test publishes it through the use case. */
export function seedSite(
  repository: InMemorySiteRepository,
  design: SiteDesign = siteDesign(),
  policy: SiteEditPolicy = permissivePolicy(),
): Site {
  const site = Site.create({
    organizationId: asId<OrganizationId>(newId()),
    draftDesign: design,
    editPolicy: policy,
    sourceTemplateKey: "retail-starter",
    sourceTemplateRevision: 1,
    now: new Date("2026-10-28T00:00:00.000Z"),
    actorUserId: asId<UserId>(newId()),
  });
  repository.site = site;
  return site;
}

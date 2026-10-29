import { defineEnum } from "../define-enum.js";
import { BRANDING_RULES } from "../organization/branding.js";
import type { LocalizedText } from "../platform/industry-template.js";
import type { SectionKey } from "./section-registry.js";
import type { SiteEditPolicy } from "./site-policy.js";
import type { StorefrontSitePageResponse } from "./website-contracts.js";

/** Safety bounds of schema version 1, not billed package limits (decision 7). */
export const SITE_DESIGN_BOUNDS = {
  schemaVersion: 1,
  maxPages: 20,
  maxSectionsPerPage: 30,
  maxMenuLinks: 100,
  maxEncodedBytes: 256 * 1024,
  maxHeadingLength: 120,
  maxHeroBodyLength: 4_000,
  maxRichTextLength: 20_000,
  maxFaqEntries: 30,
  maxFaqQuestionLength: 200,
  maxFaqAnswerLength: 2_000,
  maxTestimonialEntries: 12,
  maxQuoteLength: 500,
  maxAttributionLength: 80,
  maxLinkLabelLength: 40,
  maxPathLength: 200,
  maxRegionKeyLength: 64,
  maxOfferingIds: 20,
  maxBindingLimit: 100,
  maxAddressLength: 200,
} as const;

export const FONT_PAIR_KEY = defineEnum(["inter-noto"]);
export type FontPairKey = (typeof FONT_PAIR_KEY)[keyof typeof FONT_PAIR_KEY];

export const TYPE_SCALE = defineEnum(["SMALL", "MEDIUM", "LARGE"]);
export const RADIUS_TOKEN = defineEnum(["NONE", "SMALL", "MEDIUM", "LARGE"]);
export const BORDER_TOKEN = defineEnum(["NONE", "THIN", "MEDIUM"]);
export const SHADOW_TOKEN = defineEnum(["NONE", "LOW", "MEDIUM"]);
export const DENSITY_TOKEN = defineEnum(["COMPACT", "COMFORTABLE", "SPACIOUS"]);
export const IMAGE_RATIO_TOKEN = defineEnum(["SQUARE", "PORTRAIT", "LANDSCAPE"]);
export const CARD_SIZE_TOKEN = defineEnum(["SMALL", "MEDIUM", "LARGE"]);

export type TypeScale = (typeof TYPE_SCALE)[keyof typeof TYPE_SCALE];
export type RadiusToken = (typeof RADIUS_TOKEN)[keyof typeof RADIUS_TOKEN];
export type BorderToken = (typeof BORDER_TOKEN)[keyof typeof BORDER_TOKEN];
export type ShadowToken = (typeof SHADOW_TOKEN)[keyof typeof SHADOW_TOKEN];
export type DensityToken = (typeof DENSITY_TOKEN)[keyof typeof DENSITY_TOKEN];
export type ImageRatioToken = (typeof IMAGE_RATIO_TOKEN)[keyof typeof IMAGE_RATIO_TOKEN];
export type CardSizeToken = (typeof CARD_SIZE_TOKEN)[keyof typeof CARD_SIZE_TOKEN];

export interface SiteTokens {
  readonly color: {
    readonly primary: string;
    readonly accent: string;
    readonly background: string;
    readonly surface: string;
    readonly text: string;
    readonly mutedText: string;
    readonly onPrimary: string;
    readonly focus: string;
  };
  readonly type: { readonly fontPairKey: FontPairKey; readonly scale: TypeScale };
  readonly shape: {
    readonly cardRadius: RadiusToken;
    readonly buttonRadius: RadiusToken;
    readonly inputRadius: RadiusToken;
    readonly imageRadius: RadiusToken;
    readonly border: BorderToken;
    readonly shadow: ShadowToken;
  };
  readonly spacing: { readonly density: DensityToken };
  readonly size: {
    readonly imageRatio: ImageRatioToken;
    readonly cardSize: CardSizeToken;
    readonly columns: {
      readonly mobile: 1 | 2;
      readonly tablet: 1 | 2 | 3;
      readonly desktop: 1 | 2 | 3 | 4;
    };
  };
}

export type SiteColorTokenName = keyof SiteTokens["color"];

/** WCAG pairings the schema checks. Custom backgrounds cannot defeat contrast (decision 8). */
export const SITE_TOKEN_CONTRAST_PAIRS: readonly {
  readonly foreground: SiteColorTokenName;
  readonly background: SiteColorTokenName;
  readonly minRatio: number;
}[] = [
  { foreground: "text", background: "background", minRatio: BRANDING_RULES.primaryMinContrast },
  { foreground: "text", background: "surface", minRatio: BRANDING_RULES.primaryMinContrast },
  {
    foreground: "mutedText",
    background: "background",
    minRatio: BRANDING_RULES.primaryMinContrast,
  },
  { foreground: "mutedText", background: "surface", minRatio: BRANDING_RULES.primaryMinContrast },
  { foreground: "onPrimary", background: "primary", minRatio: BRANDING_RULES.primaryMinContrast },
  { foreground: "accent", background: "background", minRatio: BRANDING_RULES.accentMinContrast },
  { foreground: "accent", background: "surface", minRatio: BRANDING_RULES.accentMinContrast },
  { foreground: "focus", background: "background", minRatio: BRANDING_RULES.accentMinContrast },
  { foreground: "primary", background: "background", minRatio: BRANDING_RULES.accentMinContrast },
];

type MenuLinkContent = {
  readonly label: LocalizedText;
  readonly path: string;
};

export type SectionContentByKey = {
  readonly header: { readonly links: readonly MenuLinkContent[] };
  readonly footer: { readonly links: readonly MenuLinkContent[] };
  readonly hero: {
    readonly heading: LocalizedText;
    readonly body: LocalizedText;
    readonly imageFileId?: string;
    readonly actionLabel?: LocalizedText;
    readonly actionPath?: string;
  };
  readonly "rich-text": { readonly body: LocalizedText };
  readonly faq: {
    readonly entries: readonly {
      readonly question: LocalizedText;
      readonly answer: LocalizedText;
    }[];
  };
  readonly testimonials: {
    readonly entries: readonly {
      readonly quote: LocalizedText;
      readonly attribution: LocalizedText;
    }[];
  };
  readonly contact: {
    readonly heading: LocalizedText;
    readonly phone?: string;
    readonly email?: string;
    readonly address?: LocalizedText;
  };
  readonly "offering-grid": { readonly heading: LocalizedText };
  readonly "category-strip": { readonly heading: LocalizedText };
  readonly schedule: { readonly heading: LocalizedText };
  readonly plans: { readonly heading: LocalizedText };
  readonly "directory-search": { readonly heading: LocalizedText };
  readonly "directory-list": { readonly heading: LocalizedText };
};

export interface SectionBase {
  readonly sectionId: string;
  readonly variantKey: string;
  readonly regionKey: string;
  readonly binding: null | {
    readonly categoryId?: string;
    readonly offeringIds?: readonly string[];
    readonly locationId?: string;
    readonly limit: number;
  };
}

export type SiteSection = {
  [Key in SectionKey]: SectionBase & {
    readonly sectionKey: Key;
    readonly content: SectionContentByKey[Key];
  };
}[SectionKey];

export interface SitePage {
  readonly pageId: string;
  readonly path: string;
  readonly title: LocalizedText;
  readonly seo: { readonly description: LocalizedText; readonly noIndex: boolean };
  readonly sections: readonly SiteSection[];
}

export interface StaticPageDraft extends StorefrontSitePageResponse {
  readonly includeInPublication: boolean;
}

export interface SiteDesign {
  readonly schemaVersion: 1;
  readonly tokens: SiteTokens;
  readonly header: SiteSection;
  readonly footer: SiteSection;
  readonly pages: readonly SitePage[];
  readonly staticContent: readonly StaticPageDraft[];
}

export type PublishedSiteDesign = Omit<SiteDesign, "staticContent"> & {
  readonly staticContent: readonly StorefrontSitePageResponse[];
};

export interface SiteDraftResponse {
  readonly siteId: string;
  readonly version: number;
  readonly publishedWebsiteVersionId: string | null;
  readonly design: SiteDesign;
  readonly policy: SiteEditPolicy;
}

export interface SaveSiteDraftRequest {
  readonly expectedVersion: number;
  readonly design: SiteDesign;
}

export interface PublishSiteRequest {
  readonly expectedVersion: number;
}

export interface RestoreSiteRequest {
  readonly expectedVersion: number;
  readonly websiteVersionId: string;
}

export interface PublishedSiteResponse {
  readonly siteId: string;
  readonly websiteVersionId: string;
  readonly revision: number;
  readonly design: PublishedSiteDesign;
  readonly publishedAt: string;
}

/** Outbox payload: identifiers only (decision 15). */
export interface SitePublicationPayload {
  readonly siteId: string;
  readonly websiteVersionId: string;
  readonly revision: number;
}

/** `PUT /theme` carries the whole token block: a partial token set cannot be validated (decision 9). */
export interface SiteThemeUpdateRequest {
  readonly expectedVersion: number;
  readonly tokens: SiteTokens;
}

/**
 * One page without its id: a new page takes its id from `newId()`, an edited page takes it from the
 * path, so a body can never aim at another page.
 */
export interface SiteLayoutPageRequest {
  readonly expectedVersion: number;
  readonly page: Omit<SitePage, "pageId">;
}

/** `GET /layout-pages`: the page list of the draft with the version the editor holds. */
export interface SiteLayoutResponse {
  readonly siteId: string;
  readonly version: number;
  readonly pages: readonly SitePage[];
}

/**
 * Application routes the public CMS must not shadow. A path equals a prefix or continues with `/`.
 * Directory and static-page URLs stay reserved so Track M and M.6 pages keep working.
 */
export const RESERVED_PUBLIC_PATH_PREFIXES = [
  "/api",
  "/account",
  "/auth",
  "/checkout",
  "/checkouts",
  "/cart",
  "/offerings",
  "/pages",
  "/listings",
  "/search",
  "/my",
  "/sign-in",
] as const;

const RELATIVE_PUBLIC_PATH = /^\/(?:[A-Za-z0-9._~-]+\/?)*$/;
const HTTPS_PUBLIC_URL = /^https:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?(?:\/[^\s]*)?$/;
const UNSAFE_HREF = /javascript:|data:|vbscript:|expression\s*\(|url\s*\(/i;
const RAW_HTML_MARK = /<[a-zA-Z/]/;

export function isReservedPublicPath(path: string): boolean {
  return RESERVED_PUBLIC_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** Relative local paths and HTTPS only. mailto/tel belong on typed contact fields (decision 6). */
export function isAllowedPublicHref(value: string): boolean {
  if (value.length === 0 || value.length > SITE_DESIGN_BOUNDS.maxPathLength) return false;
  if (UNSAFE_HREF.test(value) || value.startsWith("//") || value.includes("..")) return false;
  return RELATIVE_PUBLIC_PATH.test(value) || HTTPS_PUBLIC_URL.test(value);
}

export function containsUnsafeContent(value: string): boolean {
  return UNSAFE_HREF.test(value) || RAW_HTML_MARK.test(value);
}

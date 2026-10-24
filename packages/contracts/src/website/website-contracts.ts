import type { LocalizedText } from "../platform/industry-template.js";
import type { SitePageKey } from "./site-page-key.js";

/** Longest page title per language (M.6 decision 1). */
export const SITE_PAGE_TITLE_MAX_LENGTH = 120;
/** Longest page body per language, in characters (M.6 decision 1). */
export const SITE_PAGE_BODY_MAX_LENGTH = 20_000;

/** Admin view of one page. A page never saved reads as an empty, unpublished page with version 0. */
export interface SitePageResponse {
  readonly pageKey: SitePageKey;
  readonly title: LocalizedText;
  readonly body: LocalizedText;
  readonly isPublished: boolean;
  /** 0 = not stored yet. */
  readonly version: number;
  readonly updatedAt: string | null;
}

/** Admin save. `version: 0` creates the page; any other value must match the stored version. */
export interface SitePageUpsertRequest {
  readonly title: LocalizedText;
  readonly body: LocalizedText;
  readonly isPublished: boolean;
  readonly version: number;
}

/** Public read of a published page (the storefront renders the Markdown body). */
export interface StorefrontSitePageResponse {
  readonly pageKey: SitePageKey;
  readonly title: LocalizedText;
  readonly body: LocalizedText;
}

export interface StorefrontSitePageSummary {
  readonly pageKey: SitePageKey;
  readonly title: LocalizedText;
}

/** Public read of a business's site: branding, features and published page titles only. */
export interface StorefrontSiteResponse {
  readonly organizationId: string;
  readonly name: string;
  readonly tagline: string | null;
  readonly logoUrl: string | null;
  readonly colors: { readonly primary: string | null; readonly accent: string | null };
  readonly features: {
    readonly directory: boolean;
    readonly credit: boolean;
    readonly customerLogin: boolean;
    readonly website: boolean;
  };
  readonly pages: readonly StorefrontSitePageSummary[];
}

/** Event payload: ids only (ADR-144). */
export interface SitePageUpdatedPayload {
  readonly pageKey: SitePageKey;
  readonly version: number;
}

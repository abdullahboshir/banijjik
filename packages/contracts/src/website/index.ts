/**
 * Website contracts of card M.6a (`@banijjik/contracts/website`, ADR-144).
 * The main index is at its line limit, so this vocabulary has its own entry.
 */
export {
  SITE_PAGE_BODY_MAX_LENGTH,
  SITE_PAGE_TITLE_MAX_LENGTH,
  type SitePageResponse,
  type SitePageUpdatedPayload,
  type SitePageUpsertRequest,
  type StorefrontSitePageResponse,
  type StorefrontSitePageSummary,
  type StorefrontSiteResponse,
} from "./website-contracts.js";
export { SITE_PAGE_KEY, type SitePageKey } from "./site-page-key.js";
export type { LocalizedText } from "../platform/industry-template.js";
export { WEBSITE_EVENT_TYPE, type WebsiteEventType } from "./website-event-type.js";

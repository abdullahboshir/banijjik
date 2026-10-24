import { defineEnum } from "../define-enum.js";

/**
 * Static page kinds of the website module (ADR-144). Cards 4.x add section pages to the same
 * module; each new key is added here first, add-only.
 */
export const SITE_PAGE_KEY = defineEnum(["ABOUT", "FAQ", "GUIDE", "TERMS", "PRIVACY", "REFUND"]);

export type SitePageKey = (typeof SITE_PAGE_KEY)[keyof typeof SITE_PAGE_KEY];

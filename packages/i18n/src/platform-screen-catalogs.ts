import bn from "./catalogs/platform/bn.json" with { type: "json" };
import en from "./catalogs/platform/en.json" with { type: "json" };
import type { Catalog } from "./bundled-catalogs.js";
import type { Locale } from "./locales.js";

/**
 * Text of the platform panel (apps/platform). Like SCREEN_CATALOGS it is kept apart from BUNDLED_CATALOGS on
 * purpose: server components read it, and client components get what they need as props, so none of it
 * travels in the first load of a page (13-UX section 11).
 */
export const PLATFORM_SCREEN_CATALOGS: Readonly<Record<Locale, Catalog>> = { bn, en };

import bn from "./catalogs/screens/bn.json" with { type: "json" };
import en from "./catalogs/screens/en.json" with { type: "json" };
import type { Catalog } from "./bundled-catalogs.js";
import type { Locale } from "./locales.js";

/**
 * Text of admin screens that only server components render (menu, banners, staff and invitation pages).
 * It is kept apart from BUNDLED_CATALOGS on purpose: those catalogs travel to the browser in every page's
 * first load (13-UX section 11), these do not. Client components get such text as props from the server.
 */
export const SCREEN_CATALOGS: Readonly<Record<Locale, Catalog>> = { bn, en };

import bn from "./catalogs/storefront/bn.json" with { type: "json" };
import en from "./catalogs/storefront/en.json" with { type: "json" };
import type { Catalog } from "./bundled-catalogs.js";
import type { Locale } from "./locales.js";

/**
 * Text of the public storefront (apps/storefront). Small on purpose: client components of the storefront
 * carry it in their first load, so it holds only what the public pages show (M.6 decision 13).
 */
export const STOREFRONT_CATALOGS: Readonly<Record<Locale, Catalog>> = { bn, en };

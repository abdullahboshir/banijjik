import bn from "./catalogs/bn.json" with { type: "json" };
import en from "./catalogs/en.json" with { type: "json" };
import type { Locale } from "./locales.js";

export type Catalog = Readonly<Record<string, string>>;

export const BUNDLED_CATALOGS: Readonly<Record<Locale, Catalog>> = { bn, en };

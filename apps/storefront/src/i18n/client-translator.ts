import {
  createCatalogTranslator,
  STOREFRONT_CATALOGS,
  type Locale,
  type Translator,
} from "@banijjik/i18n";

// One translator per locale: it holds no request data, and a stable `t` keeps React hook
// dependencies (for example the cart's quote effect) from firing on every render.
const translatorByLocale = new Map<Locale, Translator>();

/**
 * The storefront's own text for a locale. Safe in client components: it imports no server code. The
 * storefront catalog has no {brand} placeholder, so no brand name is needed here.
 */
export function translatorFor(locale: Locale): Translator {
  const cached = translatorByLocale.get(locale);
  if (cached) return cached;
  const created = createCatalogTranslator(STOREFRONT_CATALOGS[locale], { locale, brandName: "" });
  translatorByLocale.set(locale, created);
  return created;
}

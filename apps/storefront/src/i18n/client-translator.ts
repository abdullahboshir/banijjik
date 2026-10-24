import {
  createCatalogTranslator,
  STOREFRONT_CATALOGS,
  type Locale,
  type Translator,
} from "@banijjik/i18n";

/**
 * The storefront's own text for a locale. Safe in client components: it imports no server code. The
 * storefront catalog has no {brand} placeholder, so no brand name is needed here.
 */
export function translatorFor(locale: Locale): Translator {
  return createCatalogTranslator(STOREFRONT_CATALOGS[locale], { locale, brandName: "" });
}

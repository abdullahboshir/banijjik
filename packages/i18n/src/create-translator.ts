import { BUNDLED_CATALOGS, type Catalog } from "./bundled-catalogs.js";
import type { Locale } from "./locales.js";

export type TranslationValues = Readonly<Record<string, string | number>>;

export interface TranslatorOptions {
  locale: Locale;
  /** Merged over the bundled catalogs, key by key. */
  catalogs?: Partial<Record<Locale, Catalog>>;
  /** Term overrides keyed like the catalog: "term.contact.plural" becomes "ছাত্র". */
  terms?: Readonly<Record<string, string>>;
  /** Replaces {brand}. Catalogs never contain the brand name (ADR-038). */
  brandName: string;
  onMissingKey?: (key: string, locale: Locale) => void;
}

export interface Translator {
  locale: Locale;
  t: (key: string, values?: TranslationValues) => string;
  /** True when the catalog has a text for the key (no missing-key report). */
  has: (key: string) => boolean;
}

const PLACEHOLDER_PATTERN = /\{(term:)?([\w.]+)\}/g;
const BRAND_PLACEHOLDER = "brand";
const TERM_KEY_PREFIX = "term.";

/** The bundled catalog of the locale, then the options' own catalogs on top. */
export function createTranslator(options: TranslatorOptions): Translator {
  return createCatalogTranslator(BUNDLED_CATALOGS[options.locale], options);
}

/**
 * Like createTranslator, but the base catalog is given, so a browser bundle that calls only this function
 * carries no bundled catalog at all: the server hands the page the catalog of the one active locale.
 * Placeholders are replaced in one pass, so inserted values are never scanned again.
 */
export function createCatalogTranslator(
  baseCatalog: Catalog,
  options: TranslatorOptions,
): Translator {
  const { locale, brandName, onMissingKey } = options;
  const catalog: Catalog = { ...baseCatalog, ...options.catalogs?.[locale] };

  function lookup(key: string): string | undefined {
    const text = catalog[key];
    if (text === undefined) onMissingKey?.(key, locale);
    return text;
  }

  function resolveTerm(termName: string): string {
    const termKey = `${TERM_KEY_PREFIX}${termName}`;
    return options.terms?.[termKey] ?? lookup(termKey) ?? termKey;
  }

  function t(key: string, values: TranslationValues = {}): string {
    const text = lookup(key);
    if (text === undefined) return key;
    return text.replace(PLACEHOLDER_PATTERN, (placeholder, termMarker, name: string) => {
      if (termMarker) return resolveTerm(name);
      if (name === BRAND_PLACEHOLDER) return brandName;
      return String(values[name] ?? placeholder);
    });
  }

  return { locale, t, has: (key) => catalog[key] !== undefined };
}

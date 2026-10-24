import type { Locale, Translator } from "@banijjik/i18n";
import { getLocale } from "@banijjik/web-client/server";
import { translatorFor } from "./client-translator";

export { translatorFor };

export interface StorefrontTranslator {
  readonly locale: Locale;
  readonly translator: Translator;
}

/** Server side: the locale of the `locale` cookie (Bangla by default) and the storefront's own text. */
export async function storefrontTranslator(): Promise<StorefrontTranslator> {
  const locale = await getLocale();
  return { locale, translator: translatorFor(locale) };
}

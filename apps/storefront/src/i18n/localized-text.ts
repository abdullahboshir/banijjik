import type { Locale } from "@banijjik/i18n";

interface BilingualText {
  readonly bn: string;
  readonly en: string;
}

/** The text in the visitor's language, or the other language when that one is empty. */
export function localizedText(text: BilingualText, locale: Locale): string {
  const own = text[locale];
  if (own.trim() !== "") return own;
  return locale === "bn" ? text.en : text.bn;
}

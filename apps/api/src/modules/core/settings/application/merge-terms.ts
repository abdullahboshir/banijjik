import {
  TERM_TEXT_SOURCE,
  type LocalizedText,
  type PreferredLocale,
  type TermLocaleValue,
  type TermView,
} from "@banijjik/contracts";
import type { StoredTermOverride } from "./ports/term-override-repository.js";

function overrideText(
  rows: readonly StoredTermOverride[],
  termKey: string,
  locale: PreferredLocale,
): StoredTermOverride | undefined {
  return rows.find((row) => row.termKey === termKey && row.locale === locale);
}

function localeValue(
  templateText: string,
  stored: StoredTermOverride | undefined,
): TermLocaleValue {
  if (stored === undefined) return { text: templateText, source: TERM_TEXT_SOURCE.INDUSTRY };
  return { text: stored.text, source: TERM_TEXT_SOURCE.ORGANIZATION, version: stored.version };
}

/** Both languages are always present: an override replaces only the language it stores (ADR-104). */
export function mergeTermViews(
  templateTerms: Readonly<Record<string, LocalizedText>>,
  rows: readonly StoredTermOverride[],
): TermView[] {
  return Object.keys(templateTerms)
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((termKey) => {
      const template = templateTerms[termKey] as LocalizedText;
      return {
        termKey,
        bn: localeValue(template.bn, overrideText(rows, termKey, "bn")),
        en: localeValue(template.en, overrideText(rows, termKey, "en")),
      };
    });
}

/** The shape `/me/config` carries: text only, both languages. */
export function mergeTermTexts(
  templateTerms: Readonly<Record<string, LocalizedText>>,
  rows: readonly StoredTermOverride[],
): Record<string, LocalizedText> {
  const views = mergeTermViews(templateTerms, rows);
  return Object.fromEntries(
    views.map((view) => [view.termKey, { bn: view.bn.text, en: view.en.text }]),
  );
}

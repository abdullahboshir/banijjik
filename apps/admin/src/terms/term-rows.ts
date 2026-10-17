import type { TermTextSource, TermView } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";

export type TermLocale = "bn" | "en";

export interface TermLanguageView {
  text: string;
  source: TermTextSource;
  sourceLabel: string;
  /** The version of the business's own override; absent while the template text is in use. */
  version: number | undefined;
}

/** One template term with both languages; plain data, so it can cross to the client. */
export interface TermRowView {
  termKey: string;
  label: string;
  bn: TermLanguageView;
  en: TermLanguageView;
  canEdit: boolean;
}

function languageOf(language: TermView["bn"], t: Translator["t"]): TermLanguageView {
  return {
    text: language.text,
    source: language.source,
    sourceLabel: t(`terms.source.${language.source}`),
    version: language.version,
  };
}

/** A key with no friendly name (like `offering.SERVICE`) shows as itself. */
function termLabelOf(termKey: string, t: Translator["t"]): string {
  const labelKey = `terms.key.${termKey}`;
  return t(labelKey) === labelKey ? termKey : t(labelKey);
}

export function toTermRows(
  terms: readonly TermView[],
  canEdit: boolean,
  t: Translator["t"],
): TermRowView[] {
  return terms.map((term) => ({
    termKey: term.termKey,
    label: termLabelOf(term.termKey, t),
    bn: languageOf(term.bn, t),
    en: languageOf(term.en, t),
    canEdit,
  }));
}

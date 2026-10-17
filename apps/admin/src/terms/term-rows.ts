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

function knownLabel(termKey: string, t: Translator["t"]): string | undefined {
  const labelKey = `terms.key.${termKey}`;
  const text = t(labelKey);
  return text === labelKey ? undefined : text;
}

const KIND_SEPARATOR = ".";

/**
 * A term has a name in the catalog, or is a base term plus a kind (`offering.SERVICE`): the base name
 * with the kind after it. A key nothing explains shows as itself rather than hiding a term.
 */
export function termLabelOf(termKey: string, t: Translator["t"]): string {
  const direct = knownLabel(termKey, t);
  if (direct !== undefined) return direct;
  const [base = "", ...kind] = termKey.split(KIND_SEPARATOR);
  const baseLabel = knownLabel(base, t);
  if (baseLabel === undefined || kind.length === 0) return termKey;
  return `${baseLabel} · ${kind.join(KIND_SEPARATOR)}`;
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

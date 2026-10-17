import type { Translator } from "@banijjik/i18n";

export interface TermSheetLabels {
  close: string;
  save: string;
  reset: string;
  conflict: string;
  reload: string;
  bn: string;
  en: string;
}

export interface TermListLabels {
  term: string;
  bn: string;
  en: string;
  actions: string;
  change: string;
  empty: string;
}

export function termSheetLabelsOf(t: Translator["t"]): TermSheetLabels {
  return {
    close: t("shell.closeMenu"),
    save: t("common.save"),
    reset: t("terms.reset"),
    conflict: t("settings.conflict"),
    reload: t("settings.reload"),
    bn: t("terms.language.bn"),
    en: t("terms.language.en"),
  };
}

export function termListLabelsOf(t: Translator["t"]): TermListLabels {
  return {
    term: t("terms.column.term"),
    bn: t("terms.language.bn"),
    en: t("terms.language.en"),
    actions: t("terms.column.actions"),
    change: t("terms.change"),
    empty: t("terms.empty"),
  };
}

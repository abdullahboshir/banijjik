import { ENROLLMENT_PERIOD_STATUS, ENROLLMENT_STATUS } from "@banijjik/contracts/enrollment";
import type { Translator } from "@banijjik/i18n";
import { termLabel, type TermTexts } from "@banijjik/web-client";

/** The business's own words for an enrollment, a plan and a bed (decision 9: terms, never literals). */
export interface EnrollmentWords {
  readonly enrollmentTerm: string;
  readonly planTerm: string;
  readonly resourceTerm: string;
}

export function enrollmentWordsOf(translator: Translator, terms: TermTexts): EnrollmentWords {
  const { t, locale } = translator;
  return {
    enrollmentTerm: termLabel(terms, "enrollment", {
      locale,
      fallback: t("term.enrollment.singular"),
    }),
    planTerm: termLabel(terms, "offering.PLAN", { locale, fallback: t("catalog.kind.PLAN") }),
    resourceTerm: termLabel(terms, "resource", { locale, fallback: t("resources.title") }),
  };
}

export function enrollmentStatusLabels(t: Translator["t"]): Record<string, string> {
  return Object.fromEntries(
    Object.values(ENROLLMENT_STATUS).map((status) => [status, t(`enrollment.status.${status}`)]),
  );
}

export function periodStatusLabels(t: Translator["t"]): Record<string, string> {
  return Object.fromEntries(
    Object.values(ENROLLMENT_PERIOD_STATUS).map((status) => [
      status,
      t(`enrollment.periodStatus.${status}`),
    ]),
  );
}

const HISTORY_ACTIONS = [
  "create",
  "activate",
  "freeze",
  "unfreeze",
  "cancel",
  "renew",
  "expire",
  "complete",
  "markOverdue",
] as const;

/** The name of each history entry's action, as the screen shows it. */
export function historyActionNames(t: Translator["t"]): Record<string, string> {
  return Object.fromEntries(HISTORY_ACTIONS.map((key) => [key, t(`enrollment.action.${key}`)]));
}

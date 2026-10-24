import type { Translator } from "@banijjik/i18n";

export interface NewEnrollmentSheetLabels {
  readonly title: string;
  readonly close: string;
  readonly location: string;
  readonly contact: string;
  readonly plan: string;
  readonly variant: string;
  readonly startDate: string;
  readonly chooseDate: string;
  readonly choosePlan: string;
  readonly chooseVariant: string;
  readonly resource: string;
  readonly noResource: string;
  readonly save: string;
  readonly conflict: string;
  readonly reload: string;
}

export function newEnrollmentLabelsOf(input: {
  t: Translator["t"];
  enrollmentTerm: string;
  planTerm: string;
  resourceTerm: string;
}): NewEnrollmentSheetLabels {
  const { t } = input;
  return {
    title: t("enrollment.sheet.title", { term: input.enrollmentTerm }),
    close: t("enrollment.sheet.close"),
    location: t("enrollment.sheet.location"),
    contact: t("enrollment.sheet.contact"),
    plan: input.planTerm,
    variant: t("enrollment.sheet.variant"),
    startDate: t("enrollment.sheet.startDate"),
    chooseDate: t("enrollment.sheet.chooseDate"),
    choosePlan: t("enrollment.sheet.choosePlan"),
    chooseVariant: t("enrollment.sheet.chooseVariant"),
    resource: `${input.resourceTerm} (${t("enrollment.sheet.resource")})`,
    noResource: t("enrollment.sheet.noResource"),
    save: t("enrollment.sheet.save"),
    conflict: t("enrollment.sheet.conflict"),
    reload: t("enrollment.sheet.reload"),
  };
}

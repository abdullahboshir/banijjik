import type { Locale } from "@banijjik/i18n";
import { termLabel } from "@banijjik/web-client";
import type { OrgAccess } from "../shell/org-access";

export function resourceListLabels(input: {
  t: (key: string, values?: Record<string, string>) => string;
  locale: Locale;
  access: OrgAccess;
}): {
  resourceTerm: string;
  list: { name: string; type: string; status: string; edit: string; empty: string };
  sheet: {
    createTitle: string;
    editTitle: string;
    close: string;
    save: string;
    name: string;
    capacity: string;
    offerings: string;
    opens: string;
    closes: string;
    copyWeek: string;
    timeOff: string;
    timeOffStart: string;
    timeOffEnd: string;
    conflict: string;
    reload: string;
  };
  add: string;
} {
  const resourceTerm = termLabel(input.access.config.terms, "resource", {
    locale: input.locale,
    fallback: input.t("resources.title"),
  });
  return {
    resourceTerm,
    list: {
      name: input.t("resources.column.name"),
      type: input.t("resources.column.type"),
      status: input.t("resources.column.status"),
      edit: input.t("resources.edit"),
      empty: input.t("resources.list.empty", { term: resourceTerm }),
    },
    sheet: {
      createTitle: input.t("resources.form.createTitle", { term: resourceTerm }),
      editTitle: input.t("resources.form.editTitle", { term: resourceTerm }),
      close: input.t("bookings.form.close"),
      save: input.t("bookings.form.save"),
      name: input.t("resources.form.name"),
      capacity: input.t("resources.form.capacity"),
      offerings: input.t("resources.form.offerings"),
      opens: input.t("resources.form.opens"),
      closes: input.t("resources.form.closes"),
      copyWeek: input.t("resources.form.copyWeek"),
      timeOff: input.t("resources.form.timeOff"),
      timeOffStart: input.t("resources.form.timeOffStart"),
      timeOffEnd: input.t("resources.form.timeOffEnd"),
      conflict: input.t("bookings.form.conflict"),
      reload: input.t("bookings.form.reload"),
    },
    add: input.t("resources.add", { term: resourceTerm }),
  };
}

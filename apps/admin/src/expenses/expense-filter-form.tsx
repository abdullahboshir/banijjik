import type { LocationResponse } from "@banijjik/contracts";
import type { ExpenseCategoryResponse } from "@banijjik/contracts/accounting";
import type { Translator } from "@banijjik/i18n";
import { buttonVariants, FormField, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import { localizedNameOf } from "./expense-labels";
import type { ExpenseQuery } from "./expense-query";

export function ExpenseFilterForm(props: {
  query: ExpenseQuery;
  categories: ExpenseCategoryResponse[];
  locations: LocationResponse[];
  t: Translator["t"];
  locale: Translator["locale"];
}): ReactElement {
  const { query, categories, locations, t, locale } = props;
  return (
    <form method="get" className="flex flex-col gap-3" aria-label={t("expenses.filter.label")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={t("expenses.filter.from")} htmlFor="expense-from">
          <TextInput id="expense-from" name="from" type="date" defaultValue={query.from ?? ""} />
        </FormField>
        <FormField label={t("expenses.filter.to")} htmlFor="expense-to">
          <TextInput id="expense-to" name="to" type="date" defaultValue={query.to ?? ""} />
        </FormField>
        <FormField label={t("expenses.filter.category")} htmlFor="expense-filter-category">
          <select
            id="expense-filter-category"
            name="expenseCategoryId"
            defaultValue={query.expenseCategoryId ?? ""}
            className="min-h-11 w-full rounded-md border border-default bg-surface px-3 text-body"
          >
            <option value="">{t("expenses.filter.allCategories")}</option>
            {categories.map((category) => (
              <option key={category.expenseCategoryId} value={category.expenseCategoryId}>
                {localizedNameOf(category.name, locale)}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label={t("expenses.filter.location")} htmlFor="expense-filter-location">
          <select
            id="expense-filter-location"
            name="locationId"
            defaultValue={query.locationId ?? ""}
            className="min-h-11 w-full rounded-md border border-default bg-surface px-3 text-body"
          >
            <option value="">{t("expenses.filter.allLocations")}</option>
            {locations.map((location) => (
              <option key={location.locationId} value={location.locationId}>
                {location.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <button type="submit" className={`${buttonVariants({ variant: "secondary" })} self-start`}>
        {t("expenses.filter.submit")}
      </button>
    </form>
  );
}

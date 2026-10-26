import type { LocationResponse } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { buttonVariants, FormField, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { ReportRangeQuery } from "./report-query";

/** The range and location form of the reports page: a plain GET form, so the URL holds the state. */
export function ReportDailyFilter(props: {
  query: ReportRangeQuery;
  locations: readonly LocationResponse[];
  showsLocation: boolean;
  t: Translator["t"];
}): ReactElement {
  const { query, locations, showsLocation, t } = props;
  return (
    <form method="get" className="flex flex-col gap-3" aria-label={t("report.page.title")}>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label={t("report.page.from")} htmlFor="report-from">
          <TextInput id="report-from" name="from" type="date" defaultValue={query.from} />
        </FormField>
        <FormField label={t("report.page.to")} htmlFor="report-to">
          <TextInput id="report-to" name="to" type="date" defaultValue={query.to} />
        </FormField>
        {showsLocation ? (
          <FormField label={t("report.home.location")} htmlFor="report-location">
            <select
              id="report-location"
              name="location"
              defaultValue={query.locationId ?? ""}
              className="min-h-11 w-full rounded-md border border-default bg-surface px-3 text-body"
            >
              <option value="">{t("report.home.allLocations")}</option>
              {locations.map((location) => (
                <option key={location.locationId} value={location.locationId}>
                  {location.name}
                </option>
              ))}
            </select>
          </FormField>
        ) : null}
      </div>
      <button
        type="submit"
        className={`${buttonVariants({ variant: "secondary" })} min-h-11 self-start`}
      >
        {t("report.page.submit")}
      </button>
    </form>
  );
}

import type { LocationResponse } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { buttonVariants, EmptyState, FormField } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { HomeCard, HomeCardRow } from "./report-home-cards";
import { figureText } from "./report-format";

type Translate = Translator["t"];

function HomeRowView(props: {
  row: HomeCardRow;
  currency: string;
  locale: Translator["locale"];
  t: Translate;
}): ReactElement {
  const { row, currency, locale, t } = props;
  const figure = (value: number): string => figureText(row.kind, value, { currency, locale });
  return (
    <li className="flex min-h-11 flex-col gap-1 border-t border-default pt-2 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body text-secondary">{t(row.labelKey)}</span>
        <span className="text-subtitle font-semibold text-primary">{figure(row.today)}</span>
      </div>
      <p className="text-small text-secondary">
        {t("report.home.yesterdayValue", { value: figure(row.yesterday) })}
        {" · "}
        {t("report.home.monthToDate")}: {figure(row.monthToDate)}
      </p>
    </li>
  );
}

/** One home card: its rows with today first, then yesterday and this month so far. */
export function HomeCardView(props: {
  card: HomeCard;
  currency: string;
  locale: Translator["locale"];
  t: Translate;
}): ReactElement {
  const { card, currency, locale, t } = props;
  return (
    <section
      aria-label={t(card.titleKey)}
      className="flex flex-col gap-3 rounded-lg border border-default bg-surface p-4"
    >
      <h2 className="text-subtitle font-semibold text-primary">{t(card.titleKey)}</h2>
      <ul className="flex flex-col gap-2">
        {card.rows.map((row) => (
          <HomeRowView key={row.labelKey} row={row} currency={currency} locale={locale} t={t} />
        ))}
      </ul>
    </section>
  );
}

/** The location filter of the home: a plain GET form, so it works without script (page filter, ADR-004). */
export function HomeLocationFilter(props: {
  locations: readonly LocationResponse[];
  selectedLocationId: string | undefined;
  t: Translate;
}): ReactElement {
  const { locations, selectedLocationId, t } = props;
  return (
    <form
      method="get"
      className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-end xl:col-span-3"
    >
      <FormField label={t("report.home.location")} htmlFor="report-home-location">
        <select
          id="report-home-location"
          name="location"
          defaultValue={selectedLocationId ?? ""}
          className="min-h-11 w-full rounded-md border border-default bg-surface px-3 text-body sm:w-72"
        >
          <option value="">{t("report.home.allLocations")}</option>
          {locations.map((location) => (
            <option key={location.locationId} value={location.locationId}>
              {location.name}
            </option>
          ))}
        </select>
      </FormField>
      <button type="submit" className={`${buttonVariants({ variant: "secondary" })} min-h-11`}>
        {t("report.home.submit")}
      </button>
    </form>
  );
}

/** The home body when no section has a figure yet: one empty note, not a grid of zeros. */
export function HomeEmptyNote({ t }: { t: Translate }): ReactElement {
  return (
    <div className="sm:col-span-2 xl:col-span-3">
      <EmptyState message={t("report.home.empty")} />
    </div>
  );
}

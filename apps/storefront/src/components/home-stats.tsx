import type { StorefrontDirectoryStatsResponse } from "@banijjik/contracts/directory";
import type { Locale, Translator } from "@banijjik/i18n";
import { formatNumber } from "@banijjik/ui";
import type { ReactElement } from "react";
import { localizedText } from "../i18n/localized-text";

const PERCENT = 100;

export interface HomeStatsProps {
  readonly stats: StorefrontDirectoryStatsResponse;
  readonly locale: Locale;
  readonly translator: Translator;
}

/** Counts from the pre-aggregated summary: one bar per option of the template's home-statistics field. */
export function HomeStats({ stats, locale, translator }: HomeStatsProps): ReactElement {
  const count = formatNumber(stats.approvedCount, { locale });
  if (stats.approvedCount === 0) {
    return <p className="text-body text-secondary">{translator.t("storefront.home.noStats")}</p>;
  }
  return (
    <section aria-labelledby="home-stats-title" className="flex flex-col gap-3">
      <h2 id="home-stats-title" className="text-title font-semibold text-primary">
        {translator.t("storefront.home.statsTitle")}
      </h2>
      <p className="text-body text-secondary">
        {translator.t("storefront.home.approvedCount", { count })}
      </p>
      {stats.field ? (
        <ul className="flex flex-col gap-2">
          {stats.field.options.map((option) => (
            <li key={option.option} className="flex flex-col gap-1">
              <span className="flex justify-between gap-3 text-body">
                <span>{localizedText(option.label, locale)}</span>
                <span className="font-semibold">{formatNumber(option.count, { locale })}</span>
              </span>
              <span className="h-2 w-full overflow-hidden rounded bg-subtle" aria-hidden="true">
                <span
                  className="block h-full bg-brand"
                  style={{ width: `${percentOf(option.count, stats.approvedCount)}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function percentOf(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * PERCENT);
}

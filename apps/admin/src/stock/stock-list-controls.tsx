import type { Translator } from "@banijjik/i18n";
import { Button, TextInput } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { stockListHref, type StockQuery } from "./stock-query";

const CHIP_CLASS =
  "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-small transition-colors";

export function StockSearchForm(props: {
  query: StockQuery;
  searchLabel: string;
  searchSubmit: string;
}): ReactElement {
  const { query, searchLabel, searchSubmit } = props;
  return (
    <form method="get" className="flex flex-wrap items-end gap-2">
      {query.locationId ? <input type="hidden" name="location" value={query.locationId} /> : null}
      {query.lowOnly ? <input type="hidden" name="lowOnly" value="true" /> : null}
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-small text-secondary">{searchLabel}</span>
        <TextInput id="stock-search" name="q" defaultValue={query.q ?? ""} />
      </label>
      <Button type="submit">{searchSubmit}</Button>
    </form>
  );
}

export function LowStockChip(props: {
  basePath: string;
  query: StockQuery;
  label: string;
}): ReactElement {
  const isActive = props.query.lowOnly;
  const href = stockListHref(props.basePath, {
    ...props.query,
    lowOnly: !isActive,
    page: 1,
  });
  return (
    <Link
      href={href}
      aria-current={isActive ? "true" : undefined}
      className={`${CHIP_CLASS} ${isActive ? "border-brand bg-brand text-on-brand" : "border-default bg-subtle text-primary"}`}
    >
      {props.label}
    </Link>
  );
}

export function StockPager(props: {
  basePath: string;
  query: StockQuery;
  hasNext: boolean;
  t: Translator["t"];
  labels: { previous: string; next: string; current: string };
}): ReactElement {
  const { basePath, query, hasNext, labels } = props;
  const previous = query.page > 1 ? query.page - 1 : undefined;
  const next = hasNext ? query.page + 1 : undefined;
  return (
    <nav aria-label={labels.current.replace("{page}", String(query.page))} className="flex gap-2">
      {previous ? (
        <Link href={stockListHref(basePath, { ...query, page: previous })} className={CHIP_CLASS}>
          {labels.previous}
        </Link>
      ) : null}
      <span className={`${CHIP_CLASS} border-default bg-subtle`}>
        {labels.current.replace("{page}", String(query.page))}
      </span>
      {next ? (
        <Link href={stockListHref(basePath, { ...query, page: next })} className={CHIP_CLASS}>
          {labels.next}
        </Link>
      ) : null}
    </nav>
  );
}

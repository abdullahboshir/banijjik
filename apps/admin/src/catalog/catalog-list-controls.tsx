import { OFFERING_STATUS, type OfferingStatus } from "@banijjik/contracts/catalog";
import type { OfferingKind } from "@banijjik/contracts";
import type { CategoryResponse } from "@banijjik/contracts/catalog";
import type { LocationResponse } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { Button, buttonVariants, Select, TextInput } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { catalogListHref, type CatalogQuery } from "./catalog-query";

const CHIP_CLASS =
  "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-small transition-colors";
const FILTER_STATUSES: readonly OfferingStatus[] = [
  OFFERING_STATUS.DRAFT,
  OFFERING_STATUS.ACTIVE,
  OFFERING_STATUS.ARCHIVED,
];

interface ControlProps {
  basePath: string;
  query: CatalogQuery;
  t: Translator["t"];
}

interface Chip {
  key: string;
  label: string;
  isActive: boolean;
  href: string;
}

function Chips({ label, chips }: { label: string; chips: Chip[] }): ReactElement {
  return (
    <nav aria-label={label} className="flex items-center gap-2 overflow-x-auto">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.href}
          aria-current={chip.isActive ? "true" : undefined}
          className={`${CHIP_CLASS} ${chip.isActive ? "border-brand bg-brand text-on-brand" : "border-default bg-subtle text-primary"}`}
        >
          {chip.label}
        </Link>
      ))}
    </nav>
  );
}

/** One chip per kind the business offers, labelled in its own words; hidden when there is only one kind. */
export function KindChips({
  basePath,
  query,
  t,
  kinds,
  words,
}: ControlProps & {
  kinds: readonly OfferingKind[];
  words: Record<OfferingKind, string>;
}): ReactElement | null {
  if (kinds.length < 2) return null;
  const chips: Chip[] = [
    {
      key: "all",
      label: t("catalog.filter.all"),
      isActive: query.kind === undefined,
      href: catalogListHref(basePath, { ...query, kind: undefined, page: 1 }),
    },
    ...kinds.map((kind) => ({
      key: kind,
      label: words[kind],
      isActive: query.kind === kind,
      href: catalogListHref(basePath, { ...query, kind, page: 1 }),
    })),
  ];
  return <Chips label={t("catalog.filter.kind")} chips={chips} />;
}

export function StatusChips({ basePath, query, t }: ControlProps): ReactElement {
  const chips: Chip[] = [
    {
      key: "all",
      label: t("catalog.filter.all"),
      isActive: query.status === undefined,
      href: catalogListHref(basePath, { ...query, status: undefined, page: 1 }),
    },
    ...FILTER_STATUSES.map((status) => ({
      key: status,
      label: t(`catalog.status.${status}`),
      isActive: query.status === status,
      href: catalogListHref(basePath, { ...query, status, page: 1 }),
    })),
  ];
  return <Chips label={t("catalog.filter.status")} chips={chips} />;
}

/** Search, the category, and the branch whose prices to show. A plain GET form: the state stays in the address. */
export function SearchForm({
  query,
  t,
  categories,
  locations,
}: Omit<ControlProps, "basePath"> & {
  categories: readonly CategoryResponse[];
  locations: readonly LocationResponse[];
}): ReactElement {
  return (
    <form method="get" role="search" className="flex flex-col gap-2 md:flex-row">
      {query.kind ? <input type="hidden" name="kind" value={query.kind} /> : null}
      {query.status ? <input type="hidden" name="status" value={query.status} /> : null}
      <TextInput
        name="q"
        type="search"
        defaultValue={query.q ?? ""}
        aria-label={t("catalog.search.label")}
        placeholder={t("catalog.search.label")}
      />
      {categories.length > 0 ? (
        <Select
          name="categoryId"
          defaultValue={query.categoryId ?? ""}
          aria-label={t("catalog.filter.category")}
        >
          <option value="">{t("catalog.filter.categoryAll")}</option>
          {categories.map((category) => (
            <option key={category.categoryId} value={category.categoryId}>
              {category.name}
            </option>
          ))}
        </Select>
      ) : null}
      {locations.length > 1 ? (
        <Select
          name="location"
          defaultValue={query.locationId ?? ""}
          aria-label={t("catalog.filter.location")}
        >
          <option value="">{t("catalog.filter.locationAll")}</option>
          {locations.map((location) => (
            <option key={location.locationId} value={location.locationId}>
              {location.name}
            </option>
          ))}
        </Select>
      ) : null}
      <Button type="submit" variant="secondary">
        {t("catalog.search.submit")}
      </Button>
    </form>
  );
}

export function Pager({
  basePath,
  query,
  hasNext,
  t,
}: ControlProps & { hasNext: boolean }): ReactElement | null {
  if (query.page === 1 && !hasNext) return null;
  const linkClass = buttonVariants({ variant: "secondary" });
  return (
    <nav className="mt-4 flex items-center justify-between gap-3">
      {query.page > 1 ? (
        <Link
          href={catalogListHref(basePath, { ...query, page: query.page - 1 })}
          className={linkClass}
        >
          {t("catalog.page.previous")}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-small text-secondary">
        {t("catalog.page.current", { page: query.page })}
      </span>
      {hasNext ? (
        <Link
          href={catalogListHref(basePath, { ...query, page: query.page + 1 })}
          className={linkClass}
        >
          {t("catalog.page.next")}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

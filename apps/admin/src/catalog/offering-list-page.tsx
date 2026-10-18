import { PERMISSION_KEY, type OfferingKind } from "@banijjik/contracts";
import type { OfferingListItem } from "@banijjik/contracts/catalog";
import type { Translator } from "@banijjik/i18n";
import { buttonVariants, EmptyState, formatMoney, PageLayout } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import type { PageMeta } from "../lib/api/page-meta";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess, type OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { KindChips, Pager, SearchForm, StatusChips } from "./catalog-list-controls";
import { loadCatalogLookups, type CatalogLookups } from "./catalog-lookups";
import { offeringsApiPath, parseCatalogQuery, type CatalogQuery } from "./catalog-query";
import { allKindWords, catalogTitle, kindWord, type CatalogWordSource } from "./catalog-words";
import { OfferingList, type OfferingListLabels, type OfferingRowView } from "./offering-list";

function toRow(
  item: OfferingListItem,
  context: { translator: Translator; query: CatalogQuery },
): OfferingRowView {
  const { t, locale } = context.translator;
  return {
    offeringId: item.offeringId,
    name: item.name,
    imageUrl: item.firstImageUrl,
    priceText: item.priceFrom
      ? t("catalog.priceFrom", { price: formatMoney(item.priceFrom, { locale }) })
      : t("catalog.noPrice"),
    optionsText:
      item.variantCount > 1 ? t("catalog.optionsCount", { count: item.variantCount }) : "",
    status: item.status,
    statusLabel: t(`catalog.status.${item.status}`),
    branchText:
      item.isAvailable === undefined
        ? undefined
        : t(item.isAvailable ? "catalog.branch.on" : "catalog.branch.off"),
  };
}

function listLabelsOf(t: Translator["t"]): OfferingListLabels {
  return {
    name: t("catalog.column.name"),
    price: t("catalog.column.price"),
    options: t("catalog.column.options"),
    status: t("catalog.column.status"),
    branch: t("catalog.column.branch"),
  };
}

function CatalogFilters(props: {
  basePath: string;
  query: CatalogQuery;
  words: CatalogWordSource;
  lookups: CatalogLookups;
}): ReactElement {
  const { basePath, query, words, lookups } = props;
  const { t } = words.translator;
  return (
    <>
      <KindChips
        basePath={basePath}
        query={query}
        t={t}
        kinds={words.kinds}
        words={allKindWords(words)}
      />
      <StatusChips basePath={basePath} query={query} t={t} />
      <SearchForm
        query={query}
        t={t}
        categories={lookups.categories}
        locations={lookups.locations}
      />
    </>
  );
}

function newOfferingHref(orgSlug: string, kinds: readonly OfferingKind[]): string {
  const base = `/${orgSlug}/catalog/new`;
  return kinds.length === 1 ? `${base}?kind=${kinds[0]}` : base;
}

function HeaderActions({
  access,
  orgSlug,
  words,
}: {
  access: OrgAccess;
  orgSlug: string;
  words: CatalogWordSource;
}): ReactElement {
  const { kinds, permissions } = access.config;
  const { t } = words.translator;
  const canCreate =
    access.canWrite &&
    kinds.length > 0 &&
    holdsPermission(permissions, PERMISSION_KEY.CATALOG_OFFERING_CREATE);
  const single = kinds.length === 1 ? kinds[0] : undefined;
  const addLabel = t("catalog.list.add", {
    kind: single ? kindWord(words, single) : catalogTitle(words),
  });
  return (
    <>
      {holdsPermission(permissions, PERMISSION_KEY.CATALOG_CATEGORY_READ) ? (
        <Link
          href={`/${orgSlug}/catalog/categories`}
          className={buttonVariants({ variant: "secondary" })}
        >
          {t("catalog.list.categoriesLink")}
        </Link>
      ) : null}
      {holdsPermission(permissions, PERMISSION_KEY.CATALOG_MODIFIER_GROUP_READ) ? (
        <Link
          href={`/${orgSlug}/catalog/add-ons`}
          className={buttonVariants({ variant: "secondary" })}
        >
          {t("catalog.list.addOnsLink")}
        </Link>
      ) : null}
      {canCreate ? (
        <Link
          href={newOfferingHref(orgSlug, kinds)}
          className={buttonVariants({ variant: "primary" })}
        >
          {addLabel}
        </Link>
      ) : null}
    </>
  );
}

function EmptyOfferings({
  query,
  words,
  addHref,
}: {
  query: CatalogQuery;
  words: CatalogWordSource;
  addHref: string | undefined;
}): ReactElement {
  const { t } = words.translator;
  const isFiltered =
    query.q !== undefined || query.kind !== undefined || query.status !== undefined;
  const single = words.kinds.length === 1 ? words.kinds[0] : undefined;
  const word = single ? kindWord(words, single) : catalogTitle(words);
  if (isFiltered || addHref === undefined) {
    return <EmptyState kind="noResults" message={t("catalog.list.noMatch")} />;
  }
  return (
    <EmptyState
      message={`${t("catalog.list.empty", { kind: word })} ${t("catalog.list.emptyHint")}`}
      action={
        <Link href={addHref} className={buttonVariants({ variant: "primary" })}>
          {t("catalog.list.addFirst", { kind: word })}
        </Link>
      }
    />
  );
}

/** `/{orgSlug}/catalog`: the offerings of the business in its own words (13-UX section 4.1). */
export async function OfferingListPage({
  orgSlug,
  searchParams,
}: {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t } = translator;
  const { permissions, kinds, terms } = access.config;
  if (!holdsPermission(permissions, PERMISSION_KEY.CATALOG_OFFERING_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const query = parseCatalogQuery(searchParams);
  const words: CatalogWordSource = { terms, kinds, translator };
  const [offerings, lookups] = await Promise.all([
    fetchBusinessResource<OfferingListItem[], PageMeta>(
      offeringsApiPath(access.organization.organizationId, query),
    ),
    loadCatalogLookups(access),
  ]);
  const basePath = `/${orgSlug}/catalog`;
  const canAdd =
    access.canWrite && holdsPermission(permissions, PERMISSION_KEY.CATALOG_OFFERING_CREATE);
  return (
    <PageLayout
      title={catalogTitle(words)}
      subtitle={access.canWrite ? t("catalog.list.subtitle") : t("catalog.readOnly")}
      actions={<HeaderActions access={access} orgSlug={orgSlug} words={words} />}
      filters={<CatalogFilters basePath={basePath} query={query} words={words} lookups={lookups} />}
    >
      <OfferingList
        rows={offerings.data.map((item) => toRow(item, { translator, query }))}
        detailBasePath={basePath}
        labels={listLabelsOf(t)}
        empty={
          <EmptyOfferings
            query={query}
            words={words}
            addHref={canAdd && kinds.length > 0 ? newOfferingHref(orgSlug, kinds) : undefined}
          />
        }
      />
      <Pager basePath={basePath} query={query} hasNext={offerings.meta?.hasNext ?? false} t={t} />
    </PageLayout>
  );
}

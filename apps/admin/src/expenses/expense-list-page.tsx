import { PERMISSION_KEY, type LocationResponse } from "@banijjik/contracts";
import type { ExpenseCategoryResponse, ExpenseResponse } from "@banijjik/contracts/accounting";
import type { Translator } from "@banijjik/i18n";
import { EmptyState, formatMoney, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { loadCurrency } from "../catalog/catalog-lookups";
import type { PageMeta } from "../lib/api/page-meta";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess, type OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { ExpenseFilterForm } from "./expense-filter-form";
import { ExpenseListActions } from "./expense-list-actions";
import { ExpenseListPager } from "./expense-list-pager";
import { localizedNameOf, paidViaLabelOf, statusLabelOf } from "./expense-labels";
import { ExpenseList, type ExpenseRowView } from "./expense-list";
import { expensesApiPath, parseExpenseQuery } from "./expense-query";

const LOOKUP_LIMIT = 100;

function toRows(
  items: ExpenseResponse[],
  categories: Map<string, ExpenseCategoryResponse>,
  translator: Translator,
): ExpenseRowView[] {
  const { t, locale } = translator;
  return items.map((item) => {
    const category = categories.get(item.expenseCategoryId);
    return {
      expenseId: item.expenseId,
      expenseNumber: item.expenseNumber,
      amountText: formatMoney(item.amount, { locale }),
      categoryName: category ? localizedNameOf(category.name, locale) : item.expenseCategoryId,
      businessDate: item.businessDate,
      paidViaLabel: paidViaLabelOf(item.paidVia, t),
      statusLabel: statusLabelOf(item.status, t),
    };
  });
}

async function loadLookups(access: OrgAccess): Promise<{
  categories: ExpenseCategoryResponse[];
  locations: LocationResponse[];
}> {
  const { organizationId } = access.organization;
  const [categories, locations] = await Promise.all([
    fetchBusinessResourceIfAllowed<ExpenseCategoryResponse[]>(
      `/orgs/${organizationId}/expense-categories`,
    ),
    fetchBusinessResourceIfAllowed<LocationResponse[]>(
      `/orgs/${organizationId}/locations?status=ACTIVE&limit=${LOOKUP_LIMIT}`,
    ),
  ]);
  return { categories: categories ?? [], locations: locations ?? [] };
}

function ExpenseListBody(props: {
  access: OrgAccess;
  translator: Translator;
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
  list: { data: ExpenseResponse[]; meta?: PageMeta };
  lookups: { categories: ExpenseCategoryResponse[]; locations: LocationResponse[] };
  currency: Awaited<ReturnType<typeof loadCurrency>>;
}): ReactElement {
  const { access, translator, list, lookups } = props;
  const { t } = translator;
  const query = parseExpenseQuery(props.searchParams);
  const basePath = `/${props.orgSlug}/expenses`;
  const categoryMap = new Map(
    lookups.categories.map((category) => [category.expenseCategoryId, category]),
  );
  return (
    <PageLayout
      title={t("expenses.title")}
      subtitle={access.canWrite ? t("expenses.subtitle") : t("expenses.readOnly")}
      actions={
        <ExpenseListActions
          access={access}
          basePath={basePath}
          categories={lookups.categories}
          locations={lookups.locations}
          currency={props.currency}
          t={t}
        />
      }
    >
      <ExpenseFilterForm
        query={query}
        categories={lookups.categories}
        locations={lookups.locations}
        t={t}
        locale={translator.locale}
      />
      <ExpenseList
        rows={toRows(list.data, categoryMap, translator)}
        labels={{
          number: t("expenses.column.number"),
          amount: t("expenses.column.amount"),
          category: t("expenses.column.category"),
          date: t("expenses.column.date"),
          paidVia: t("expenses.column.paidVia"),
          status: t("expenses.column.status"),
          empty: t("expenses.empty"),
        }}
        detailBasePath={basePath}
      />
      <ExpenseListPager
        basePath={basePath}
        query={query}
        hasNext={list.meta?.hasNext === true}
        t={t}
      />
    </PageLayout>
  );
}

/** `/{orgSlug}/expenses`: filtered list and add sheet. */
export async function ExpenseListPage(props: {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.EXPENSE_EXPENSE_READ)) {
    return <EmptyState kind="noPermission" message={translator.t("state.permissionDenied")} />;
  }
  const query = parseExpenseQuery(props.searchParams);
  const [list, lookups, currency] = await Promise.all([
    fetchBusinessResource<ExpenseResponse[], PageMeta>(
      expensesApiPath(access.organization.organizationId, query),
    ),
    loadLookups(access),
    loadCurrency(access),
  ]);
  return (
    <ExpenseListBody
      access={access}
      translator={translator}
      orgSlug={props.orgSlug}
      searchParams={props.searchParams}
      list={list}
      lookups={lookups}
      currency={currency}
    />
  );
}

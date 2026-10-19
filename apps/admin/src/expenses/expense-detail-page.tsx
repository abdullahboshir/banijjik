import { PERMISSION_KEY, type LocationResponse } from "@banijjik/contracts";
import type { ExpenseCategoryResponse, ExpenseResponse } from "@banijjik/contracts/accounting";
import { DetailHeader, EmptyState, formatMoney } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { ExpenseDetailFacts } from "./expense-detail-facts";
import { statusLabelOf } from "./expense-labels";
import { ExpenseVoidButton } from "./expense-void-button";

function voidLabelsOf(t: (key: string) => string) {
  return {
    title: t("expenses.void.title"),
    description: t("expenses.void.description"),
    reason: t("expenses.void.reason"),
    confirm: t("expenses.void.confirm"),
    cancel: t("expenses.void.cancel"),
    close: t("expenses.void.close"),
    conflict: t("expenses.void.conflict"),
    trigger: t("expenses.detail.void"),
  };
}

async function loadExpenseDetail(organizationId: string, expenseId: string) {
  const { data: expense } = await fetchBusinessResource<ExpenseResponse>(
    `/orgs/${organizationId}/expenses/${expenseId}`,
  );
  const [categories, locations] = await Promise.all([
    fetchBusinessResourceIfAllowed<ExpenseCategoryResponse[]>(
      `/orgs/${organizationId}/expense-categories`,
    ),
    fetchBusinessResourceIfAllowed<LocationResponse[]>(
      `/orgs/${organizationId}/locations?status=ACTIVE&limit=100`,
    ),
  ]);
  return { expense, categories, locations };
}

/** `/{orgSlug}/expenses/{expenseId}`: facts, attachments and void. */
export async function ExpenseDetailPage(props: {
  orgSlug: string;
  expenseId: string;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  const { t, locale } = translator;
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.EXPENSE_EXPENSE_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const { organizationId } = access.organization;
  const { expense, categories, locations } = await loadExpenseDetail(
    organizationId,
    props.expenseId,
  );
  const canVoid =
    access.canWrite &&
    holdsPermission(access.config.permissions, PERMISSION_KEY.EXPENSE_EXPENSE_VOID) &&
    expense.status === "POSTED";
  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        title={expense.expenseNumber}
        backHref={`/${props.orgSlug}/expenses`}
        backLabel={t("expenses.detail.back")}
        status={<span className="text-body text-primary">{statusLabelOf(expense.status, t)}</span>}
        facts={
          <span className="text-body text-primary">{formatMoney(expense.amount, { locale })}</span>
        }
      />
      {canVoid ? (
        <ExpenseVoidButton
          organizationId={organizationId}
          expenseId={expense.expenseId}
          version={expense.version}
          labels={voidLabelsOf(t)}
        />
      ) : null}
      <ExpenseDetailFacts
        expense={expense}
        category={categories?.find((row) => row.expenseCategoryId === expense.expenseCategoryId)}
        location={locations?.find((row) => row.locationId === expense.locationId)}
        organizationId={organizationId}
        t={t}
        locale={locale}
      />
    </div>
  );
}

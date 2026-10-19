import { PERMISSION_KEY } from "@banijjik/contracts";
import type { ExpenseCategoryResponse } from "@banijjik/contracts/accounting";
import { buttonVariants, EmptyState, PageLayout } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { ExpenseCategoriesManager, type ExpenseCategoryLabels } from "./categories-manager";

function labelsOf(t: (key: string) => string): ExpenseCategoryLabels {
  return {
    add: t("expenses.categories.add"),
    nameBn: t("expenses.categories.nameBn"),
    nameEn: t("expenses.categories.nameEn"),
    save: t("expenses.categories.save"),
    archive: t("expenses.categories.archive"),
    edit: t("expenses.categories.edit"),
    close: t("expenses.categories.close"),
    empty: t("expenses.categories.empty"),
    system: t("expenses.categories.system"),
    conflict: t("expenses.categories.conflict"),
    reload: t("expenses.categories.reload"),
    archived: t("expenses.categories.archived"),
  };
}

/** `/{orgSlug}/expenses/categories`: add, rename and archive expense categories. */
export async function ExpenseCategoriesPage({
  orgSlug,
}: {
  orgSlug: string;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t, locale } = translator;
  const { permissions } = access.config;
  if (!holdsPermission(permissions, PERMISSION_KEY.EXPENSE_CATEGORY_UPDATE)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const { organizationId } = access.organization;
  const categories = await fetchBusinessResource<ExpenseCategoryResponse[]>(
    `/orgs/${organizationId}/expense-categories`,
  );
  return (
    <PageLayout
      title={t("expenses.categories.title")}
      subtitle={
        access.canWrite ? t("expenses.categories.subtitle") : t("expenses.categories.readOnly")
      }
      actions={
        <Link href={`/${orgSlug}/expenses`} className={buttonVariants({ variant: "secondary" })}>
          {t("expenses.categories.back")}
        </Link>
      }
    >
      <ExpenseCategoriesManager
        organizationId={organizationId}
        categories={categories.data}
        labels={labelsOf(t)}
        canUpdate={access.canWrite}
        locale={locale}
      />
    </PageLayout>
  );
}

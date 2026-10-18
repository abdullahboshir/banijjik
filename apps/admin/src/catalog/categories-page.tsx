import { PERMISSION_KEY } from "@banijjik/contracts";
import type { CategoryResponse, SynonymsResponse } from "@banijjik/contracts/catalog";
import { buttonVariants, EmptyState, PageLayout } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { CategoriesManager } from "./categories-manager";
import { categoryLabelsOf } from "./manager-labels";
import { SynonymsEditor } from "./synonyms-editor";

const CATEGORY_PAGE_LIMIT = 100;

/** `/{orgSlug}/catalog/categories`: the category tree and, below it, the words customers use. */
export async function CategoriesPage({ orgSlug }: { orgSlug: string }): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t } = translator;
  const { permissions } = access.config;
  if (!holdsPermission(permissions, PERMISSION_KEY.CATALOG_CATEGORY_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const { organizationId } = access.organization;
  const [categories, synonyms] = await Promise.all([
    fetchBusinessResource<CategoryResponse[]>(
      `/orgs/${organizationId}/categories?limit=${CATEGORY_PAGE_LIMIT}`,
    ),
    fetchBusinessResourceIfAllowed<SynonymsResponse>(`/orgs/${organizationId}/catalog/synonyms`),
  ]);
  const can = (key: Parameters<typeof holdsPermission>[1]): boolean =>
    access.canWrite && holdsPermission(permissions, key);
  const labels = categoryLabelsOf(t);
  return (
    <PageLayout
      title={t("catalog.categories.title")}
      subtitle={
        access.canWrite ? t("catalog.categories.subtitle") : t("catalog.categories.readOnly")
      }
      actions={
        <Link href={`/${orgSlug}/catalog`} className={buttonVariants({ variant: "secondary" })}>
          {t("catalog.editor.back")}
        </Link>
      }
    >
      <CategoriesManager
        organizationId={organizationId}
        categories={categories.data}
        labels={labels}
        canCreate={can(PERMISSION_KEY.CATALOG_CATEGORY_CREATE)}
        canUpdate={can(PERMISSION_KEY.CATALOG_CATEGORY_UPDATE)}
        canArchive={can(PERMISSION_KEY.CATALOG_CATEGORY_ARCHIVE)}
      />
      {synonyms ? (
        <SynonymsEditor
          key={synonyms.version}
          organizationId={organizationId}
          synonyms={synonyms}
          labels={labels}
          canUpdate={can(PERMISSION_KEY.CATALOG_SYNONYM_UPDATE)}
        />
      ) : null}
    </PageLayout>
  );
}

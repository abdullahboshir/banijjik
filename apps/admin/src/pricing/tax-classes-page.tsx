import { PERMISSION_KEY } from "@banijjik/contracts";
import type { TaxClassResponse } from "@banijjik/contracts/pricing";
import { buttonVariants, EmptyState, PageLayout } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { taxClassLabelsOf } from "./pricing-labels";
import { TaxClassesManager } from "./tax-classes-manager";

const PAGE_LIMIT = 100;

/** `/{orgSlug}/settings/tax-classes`: the sales tax classes of the business. */
export async function TaxClassesPage({ orgSlug }: { orgSlug: string }): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t } = translator;
  const { permissions } = access.config;
  if (!holdsPermission(permissions, PERMISSION_KEY.PRICING_TAX_CLASS_UPDATE)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const { organizationId } = access.organization;
  const listed = await fetchBusinessResource<TaxClassResponse[]>(
    `/orgs/${organizationId}/tax-classes?limit=${PAGE_LIMIT}`,
  );
  const labels = taxClassLabelsOf(t);
  return (
    <PageLayout
      title={labels["taxClasses.title"]}
      subtitle={access.canWrite ? labels["taxClasses.subtitle"] : labels["taxClasses.readOnly"]}
      actions={
        <Link href={`/${orgSlug}/settings`} className={buttonVariants({ variant: "secondary" })}>
          {t("settings.home.title")}
        </Link>
      }
    >
      <TaxClassesManager
        organizationId={organizationId}
        taxClasses={[...listed.data]}
        labels={labels}
        canUpdate={access.canWrite}
      />
    </PageLayout>
  );
}

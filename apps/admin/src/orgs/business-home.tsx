import {
  ORGANIZATION_STATUS,
  type MeResponse,
  type MyOrganizationSummary,
} from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { EmptyState, PageHeader, TopBar } from "@banijjik/ui";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import { getTranslator } from "../lib/i18n/get-translator";
import { AccountMenuContainer } from "../shell/account-menu-container";
import { BrandLogo } from "../shell/brand-logo";
import { BusinessList, type BusinessRow } from "./business-list";
import { roleNamesOf } from "./role-names";

export interface BusinessHomeProps {
  me: MeResponse;
  organizations: MyOrganizationSummary[];
}

function toBusinessRows(organizations: MyOrganizationSummary[], t: Translator["t"]): BusinessRow[] {
  return organizations.map((organization) => ({
    organizationId: organization.organizationId,
    slug: organization.slug,
    name: organization.name,
    roleNames: roleNamesOf(organization.roleKeys, t),
    isSuspended: organization.status === ORGANIZATION_STATUS.SUSPENDED,
  }));
}

/**
 * What `/` shows a signed-in person: one business goes straight in (a full navigation, ADR-022), several
 * are listed, none gives an empty state. Creating a business is not here yet (cards 2.1 and 6.1).
 */
export async function BusinessHome({
  me,
  organizations,
}: BusinessHomeProps): Promise<ReactElement> {
  const [onlyOrganization] = organizations;
  if (organizations.length === 1 && onlyOrganization) redirect(`/${onlyOrganization.slug}`);
  const { t } = await getTranslator();
  return (
    <>
      <TopBar
        logo={<BrandLogo />}
        organizationName=""
        actions={<AccountMenuContainer userName={me.name} initialOrganizations={organizations} />}
      />
      <main className="mx-auto w-full max-w-3xl p-4 md:p-6">
        <PageHeader title={t("orgs.title")} />
        <BusinessList
          rows={toBusinessRows(organizations, t)}
          labels={{
            nameColumn: t("orgs.column.name"),
            rolesColumn: t("orgs.column.roles"),
            statusColumn: t("orgs.column.status"),
            suspended: t("orgs.status.suspended"),
            empty: <EmptyState message={t("orgs.empty")} />,
          }}
        />
      </main>
    </>
  );
}

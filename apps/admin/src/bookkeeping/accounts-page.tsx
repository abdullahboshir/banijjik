import { PERMISSION_KEY } from "@banijjik/contracts";
import type { AccountResponse } from "@banijjik/contracts/accounting";
import { EmptyState, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { holdsPermission } from "../shell/permissions";
import { bookkeepingAccess, queryText, type BookkeepingPageProps } from "./page-access";
import { AccountsView } from "./accounts-view";
import { BookkeepingPager } from "./page-controls";
export async function AccountsPage(props: BookkeepingPageProps): Promise<ReactElement> {
  const { translator, access, labels } = await bookkeepingAccess(props.orgSlug);
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.BOOKKEEPING_ACCOUNT_READ))
    return <EmptyState kind="noPermission" message={translator.t("state.permissionDenied")} />;
  const page = Math.max(1, Number(queryText(props.searchParams["page"])) || 1);
  const result = await fetchBusinessResource<AccountResponse[], { hasNext: boolean }>(
    `/orgs/${access.organization.organizationId}/bookkeeping/accounts?page=${page}&limit=100`,
  );
  return (
    <PageLayout title={labels["accounts"]}>
      <AccountsView
        organizationId={access.organization.organizationId}
        accounts={result.data}
        labels={labels}
        locale={translator.locale}
        canCreate={
          access.canWrite &&
          holdsPermission(access.config.permissions, PERMISSION_KEY.BOOKKEEPING_ACCOUNT_CREATE)
        }
        canUpdate={
          access.canWrite &&
          holdsPermission(access.config.permissions, PERMISSION_KEY.BOOKKEEPING_ACCOUNT_UPDATE)
        }
      />
      <BookkeepingPager
        page={page}
        hasNext={result.meta?.hasNext === true}
        labels={labels}
        searchParams={props.searchParams}
      />
    </PageLayout>
  );
}

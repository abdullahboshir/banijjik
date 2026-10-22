import { PERMISSION_KEY } from "@banijjik/contracts";
import type { AccountResponse } from "@banijjik/contracts/accounting";
import { EmptyState, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { holdsPermission } from "../shell/permissions";
import { bookkeepingAccess, todayIso, type BookkeepingPageProps } from "./page-access";
import type { LocationResponse } from "@banijjik/contracts";
import { EntryForm } from "./entry-form-view";
export async function NewEntryPage(props: BookkeepingPageProps): Promise<ReactElement> {
  const { translator, access, labels } = await bookkeepingAccess(props.orgSlug);
  if (
    !access.canWrite ||
    !holdsPermission(access.config.permissions, PERMISSION_KEY.BOOKKEEPING_JOURNAL_CREATE_MANUAL)
  )
    return <EmptyState kind="noPermission" message={translator.t("state.permissionDenied")} />;
  const locations = await fetchBusinessResource<LocationResponse[]>(
    `/orgs/${access.organization.organizationId}/locations?limit=100`,
  );
  const accounts = await fetchBusinessResource<AccountResponse[]>(
    `/orgs/${access.organization.organizationId}/bookkeeping/accounts?limit=100`,
  );
  return (
    <PageLayout title={labels["newEntry"]}>
      <EntryForm
        organizationId={access.organization.organizationId}
        orgSlug={props.orgSlug}
        accounts={accounts.data}
        labels={labels}
        today={todayIso()}
        userId={access.me.userId}
        locale={translator.locale}
        locations={locations.data}
      />
    </PageLayout>
  );
}

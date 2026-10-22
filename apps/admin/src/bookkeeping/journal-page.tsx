import { PERMISSION_KEY } from "@banijjik/contracts";
import type { AccountResponse } from "@banijjik/contracts/accounting";
import { EmptyState, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { holdsPermission } from "../shell/permissions";
import { bookkeepingAccess, queryText, todayIso, type BookkeepingPageProps } from "./page-access";
import type { JournalEntryResponse } from "@banijjik/contracts/accounting";
import { buttonVariants } from "@banijjik/ui";
import Link from "next/link";
import { JournalView } from "./journal-view";
import { BookkeepingFilters, BookkeepingPager } from "./page-controls";
export async function JournalPage(props: BookkeepingPageProps): Promise<ReactElement> {
  const { translator, access, labels } = await bookkeepingAccess(props.orgSlug);
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.BOOKKEEPING_JOURNAL_READ))
    return <EmptyState kind="noPermission" message={translator.t("state.permissionDenied")} />;
  const { params, page } = journalQuery(props.searchParams);
  const result = await fetchBusinessResource<JournalEntryResponse[], { hasNext: boolean }>(
    `/orgs/${access.organization.organizationId}/bookkeeping/journal?${params}`,
  );
  const choices = await journalChoices(access.organization.organizationId, params);
  const canReverse =
    access.canWrite &&
    holdsPermission(access.config.permissions, PERMISSION_KEY.BOOKKEEPING_JOURNAL_CREATE_MANUAL);
  return (
    <PageLayout
      title={labels["journal"]}
      actions={
        canReverse ? (
          <Link
            className={buttonVariants({ variant: "primary" })}
            href={`/${props.orgSlug}/money/journal/new`}
          >
            {labels["newEntry"]}
          </Link>
        ) : undefined
      }
    >
      <BookkeepingFilters
        organizationId={access.organization.organizationId}
        labels={labels}
        query={params}
        journal
        accounts={choices}
        locale={translator.locale}
      />
      <JournalView
        locale={translator.locale}
        organizationId={access.organization.organizationId}
        userId={access.me.userId}
        entries={result.data}
        labels={labels}
        canReverse={canReverse}
        today={todayIso()}
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

function journalQuery(searchParams: BookkeepingPageProps["searchParams"]): {
  params: URLSearchParams;
  page: number;
} {
  const params = new URLSearchParams();
  for (const key of ["from", "to", "sourceType", "accountId", "page"]) {
    const value = queryText(searchParams[key]);
    if (value !== "") params.set(key, value);
  }
  const page = Math.max(1, Number(params.get("page")) || 1);
  params.set("page", String(page));
  params.set("limit", "20");
  return { params, page };
}

async function journalChoices(
  organizationId: string,
  params: URLSearchParams,
): Promise<AccountResponse[]> {
  const choices = await fetchBusinessResource<AccountResponse[]>(
    `/orgs/${organizationId}/bookkeeping/accounts?limit=100`,
  );
  const selectedAccount = params.get("accountId");
  if (
    selectedAccount !== null &&
    !choices.data.some((account) => account.accountId === selectedAccount)
  ) {
    const selected = await fetchBusinessResource<AccountResponse[]>(
      `/orgs/${organizationId}/bookkeeping/accounts?accountId=${encodeURIComponent(selectedAccount)}`,
    );
    choices.data.push(...selected.data);
  }
  return choices.data;
}

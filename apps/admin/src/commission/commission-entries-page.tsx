import { MODULE_KEY, PERMISSION_KEY } from "@banijjik/contracts";
import type {
  CommissionEntryResponse,
  CommissionMemberSummaryResponse,
} from "@banijjik/contracts/commission";
import { EmptyState, PageLayout } from "@banijjik/ui";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import type { PageMeta } from "../lib/api/page-meta";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { CommissionEntryList } from "./commission-entry-list";
import { CommissionEntryFilterForm } from "./commission-filters";
import { loadCommissionLocations, loadCommissionMembers } from "./commission-lookups";
import { CommissionPager } from "./commission-pager";
import {
  commissionEntriesApiPath,
  commissionEntryListHref,
  commissionSummaryApiPath,
  parseCommissionEntryQuery,
} from "./commission-query";
import { CommissionSummaryCards } from "./commission-summary-cards";

/** `/{orgSlug}/commission/entries`: the entry list, filters and the per-member summary cards. */
export async function CommissionEntriesPage(props: {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  if (!access.config.modules.includes(MODULE_KEY.COMMISSION)) notFound();
  const { t } = translator;
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.COMMISSION_ENTRY_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const { organizationId } = access.organization;
  const query = parseCommissionEntryQuery(props.searchParams);
  const [list, summary, members, locations] = await Promise.all([
    fetchBusinessResource<CommissionEntryResponse[], PageMeta>(
      commissionEntriesApiPath(organizationId, query),
    ),
    fetchBusinessResource<CommissionMemberSummaryResponse[]>(
      commissionSummaryApiPath(organizationId, query),
    ),
    loadCommissionMembers(access),
    loadCommissionLocations(access),
  ]);
  const basePath = `/${props.orgSlug}/commission/entries`;
  return (
    <PageLayout
      title={t("commission.entries.title")}
      subtitle={t("commission.entries.subtitle")}
      filters={
        <CommissionEntryFilterForm query={query} members={members} locations={locations} t={t} />
      }
    >
      <CommissionSummaryCards rows={summary.data} />
      <CommissionEntryList entries={list.data} showMember />
      <CommissionPager
        page={query.page}
        previousHref={
          query.page > 1
            ? commissionEntryListHref(basePath, { ...query, page: query.page - 1 })
            : undefined
        }
        nextHref={
          list.meta?.hasNext === true
            ? commissionEntryListHref(basePath, { ...query, page: query.page + 1 })
            : undefined
        }
        t={t}
      />
    </PageLayout>
  );
}

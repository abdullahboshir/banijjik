import { MODULE_KEY, PERMISSION_KEY } from "@banijjik/contracts";
import type { CommissionEntryResponse } from "@banijjik/contracts/commission";
import { EmptyState, PageLayout } from "@banijjik/ui";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import type { PageMeta } from "../lib/api/page-meta";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { CommissionEntryList } from "./commission-entry-list";
import { CommissionMyFilterForm } from "./commission-filters";
import { CommissionPager } from "./commission-pager";
import {
  commissionEntriesApiPath,
  commissionEntryListHref,
  parseCommissionMyEntriesQuery,
} from "./commission-query";

/** `/{orgSlug}/commission/mine`: the caller's own entries; reached from the account menu, not the sidebar. */
export async function CommissionMinePage(props: {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  if (!access.config.modules.includes(MODULE_KEY.COMMISSION)) notFound();
  const { t } = translator;
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.COMMISSION_ENTRY_READ_OWN)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const query = parseCommissionMyEntriesQuery(props.searchParams);
  const list = await fetchBusinessResource<CommissionEntryResponse[], PageMeta>(
    commissionEntriesApiPath(access.organization.organizationId, query, "my-entries"),
  );
  const basePath = `/${props.orgSlug}/commission/mine`;
  return (
    <PageLayout
      title={t("commission.mine.title")}
      subtitle={t("commission.mine.subtitle")}
      filters={<CommissionMyFilterForm query={query} t={t} />}
    >
      <CommissionEntryList entries={list.data} showMember={false} />
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

import { MODULE_KEY, PERMISSION_KEY } from "@banijjik/contracts";
import type {
  CommissionMemberSummaryResponse,
  CommissionPayoutResponse,
} from "@banijjik/contracts/commission";
import { EmptyState, PageLayout } from "@banijjik/ui";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { todayInTimeZone } from "../bookings/booking-query";
import type { PageMeta } from "../lib/api/page-meta";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { CommissionPayoutFilterForm } from "./commission-filters";
import {
  loadCommissionCurrency,
  loadCommissionLocations,
  type CommissionMemberOption,
} from "./commission-lookups";
import { CommissionPager } from "./commission-pager";
import { CommissionPayoutsView } from "./commission-payouts-view";
import {
  commissionPayoutListHref,
  commissionPayoutsApiPath,
  commissionSummaryApiPath,
  parseCommissionPayoutQuery,
} from "./commission-query";

function memberOptionsOf(
  summary: readonly CommissionMemberSummaryResponse[] | undefined,
): CommissionMemberOption[] {
  return (summary ?? []).map((row) => ({ memberId: row.memberId, name: row.memberName }));
}

/** `/{orgSlug}/commission/payouts`: what was paid, and paying a member's open commission. */
export async function CommissionPayoutsPage(props: {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  if (!access.config.modules.includes(MODULE_KEY.COMMISSION)) notFound();
  const { t } = translator;
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.COMMISSION_PAYOUT_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const query = parseCommissionPayoutQuery(props.searchParams);
  const data = await loadCommissionPayoutsData(access, query);
  return (
    <CommissionPayoutsContent
      orgSlug={props.orgSlug}
      access={access}
      t={t}
      query={query}
      data={data}
    />
  );
}

async function loadCommissionPayoutsData(
  access: Awaited<ReturnType<typeof requireOrgAccess>>,
  query: ReturnType<typeof parseCommissionPayoutQuery>,
) {
  const { organizationId } = access.organization;
  const [list, summary, locations, currency] = await Promise.all([
    fetchBusinessResource<CommissionPayoutResponse[], PageMeta>(
      commissionPayoutsApiPath(organizationId, query),
    ),
    fetchBusinessResourceIfAllowed<CommissionMemberSummaryResponse[]>(
      commissionSummaryApiPath(organizationId, {
        memberId: undefined,
        locationId: query.locationId,
        from: undefined,
        to: undefined,
        page: 1,
      }),
    ),
    loadCommissionLocations(access),
    loadCommissionCurrency(access),
  ]);
  return { organizationId, list, summary, locations, currency };
}

function CommissionPayoutsContent(props: {
  orgSlug: string;
  access: Awaited<ReturnType<typeof requireOrgAccess>>;
  t: (key: string, values?: Record<string, string | number>) => string;
  query: ReturnType<typeof parseCommissionPayoutQuery>;
  data: Awaited<ReturnType<typeof loadCommissionPayoutsData>>;
}): ReactElement {
  const { orgSlug, access, t, query, data } = props;
  const { organizationId, list, summary, locations, currency } = data;
  const basePath = `/${orgSlug}/commission/payouts`;
  const canPay =
    access.canWrite &&
    holdsPermission(access.config.permissions, PERMISSION_KEY.COMMISSION_PAYOUT_CREATE);
  return (
    <PageLayout
      title={t("commission.payouts.title")}
      subtitle={t("commission.payouts.subtitle")}
      filters={
        <CommissionPayoutFilterForm
          query={query}
          members={memberOptionsOf(summary)}
          locations={locations}
          t={t}
        />
      }
    >
      <CommissionPayoutsView
        organizationId={organizationId}
        currency={currency}
        payouts={list.data}
        summary={summary ?? []}
        locations={locations}
        canPay={canPay}
        defaultUpTo={todayInTimeZone(access.timeZone)}
        detailBasePath={basePath}
      />
      <CommissionPager
        page={query.page}
        previousHref={
          query.page > 1
            ? commissionPayoutListHref(basePath, { ...query, page: query.page - 1 })
            : undefined
        }
        nextHref={
          list.meta?.hasNext === true
            ? commissionPayoutListHref(basePath, { ...query, page: query.page + 1 })
            : undefined
        }
        t={t}
      />
    </PageLayout>
  );
}

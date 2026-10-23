import { PERMISSION_KEY, SYSTEM_ROLE_KEY, type LocationResponse } from "@banijjik/contracts";
import { EmptyState, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fillLabel } from "../catalog/catalog-labels";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import type { CreditPurchasePage } from "./credit-purchase-api";
import { creditPurchaseLabelsOf } from "./credit-purchase-labels";
import { parseCreditPurchasesQuery, type CreditPurchasesQuery } from "./credit-purchase-query";
import { CreditPurchasesManager } from "./credit-purchases-manager";

const LOCATION_LIMIT = 100;

export interface CreditPurchasesPageProps {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}

async function loadPurchasesData(args: {
  organizationId: string;
  query: CreditPurchasesQuery;
  canVerify: boolean;
  isOwner: boolean;
}) {
  const { organizationId, query, canVerify, isOwner } = args;
  const search = new URLSearchParams({
    page: String(query.page),
    limit: "50",
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.q !== undefined ? { q: query.q } : {}),
  }).toString();

  const [purchasesResult, locationsResult] = await Promise.all([
    fetchBusinessResource<CreditPurchasePage>(`/orgs/${organizationId}/credit/purchases?${search}`),
    canVerify && !isOwner
      ? fetchBusinessResourceIfAllowed<LocationResponse[]>(
          `/orgs/${organizationId}/locations?status=ACTIVE&limit=${LOCATION_LIMIT}`,
        )
      : undefined,
  ]);

  const locations = (locationsResult ?? []).map((loc) => ({
    locationId: loc.locationId,
    name: loc.name,
  }));
  return { purchases: purchasesResult.data.items, total: purchasesResult.data.total, locations };
}

export async function CreditPurchasesPage(props: {
  orgSlug: string;
  searchParams?: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  const { t, locale } = translator;
  const { permissions } = access.config;

  if (!holdsPermission(permissions, PERMISSION_KEY.CREDIT_PURCHASE_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }

  const { organizationId, roleKeys } = access.organization;
  const query = parseCreditPurchasesQuery(props.searchParams ?? {});
  const labels = creditPurchaseLabelsOf(t);
  const basePath = `/${props.orgSlug}/credit/purchases`;

  const canVerify =
    access.canWrite && holdsPermission(permissions, PERMISSION_KEY.CREDIT_PURCHASE_VERIFY);
  const isOwner = roleKeys.includes(SYSTEM_ROLE_KEY.OWNER);

  const { purchases, total, locations } = await loadPurchasesData({
    organizationId,
    query,
    canVerify,
    isOwner,
  });

  const subtitle = access.canWrite
    ? fillLabel(labels.subtitle, { count: String(total) })
    : labels.readOnly;

  return (
    <PageLayout title={labels.title} subtitle={subtitle}>
      <CreditPurchasesManager
        organizationId={organizationId}
        purchases={purchases}
        total={total}
        query={query}
        basePath={basePath}
        canVerify={canVerify}
        isOwner={isOwner}
        locations={locations}
        locale={locale}
        labels={labels}
      />
    </PageLayout>
  );
}

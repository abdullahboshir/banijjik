import { PLATFORM_PERMISSION_KEY, type PlatformOrganizationSummary } from "@banijjik/contracts";
import { EmptyState, PageLayout } from "@banijjik/ui";
import type { PageMeta } from "@banijjik/web-client";
import type { ReactElement } from "react";
import { fetchPlatformResource } from "../api/platform-resource";
import { holdsPermission } from "../auth/permissions";
import { loadOperator } from "../auth/session-data";
import { getTranslator } from "../i18n/get-translator";
import { FilterChips, type FilterChipLink } from "../lists/filter-chips";
import { ListPager } from "../lists/list-pager";
import { formatCount } from "../lib/format";
import { organizationTone } from "../lib/status-tones";
import {
  TENANT_FILTER_STATUSES,
  parseTenantQuery,
  tenantListHref,
  tenantsApiPath,
  type TenantQuery,
} from "./tenant-query";
import { TenantList, type TenantRowView } from "./tenant-list";
import { TenantSearch } from "./tenant-search";
import type { RawParams } from "../lists/list-query";
import type { Translator } from "@banijjik/i18n";

function toRow(tenant: PlatformOrganizationSummary, translator: Translator): TenantRowView {
  const { t, locale } = translator;
  return {
    organizationId: tenant.organizationId,
    name: tenant.name,
    slug: tenant.slug,
    templateKey: tenant.templateKey,
    statusLabel: t(`platform.status.organization.${tenant.status}`),
    statusTone: organizationTone(tenant.status),
    subscriptionLabel: tenant.subscriptionStatus
      ? t(`platform.status.subscription.${tenant.subscriptionStatus}`)
      : t("platform.subscription.none"),
    memberCountLabel: formatCount(tenant.memberCount, locale),
  };
}

function statusChips(query: TenantQuery, t: Translator["t"]): FilterChipLink[] {
  const all: FilterChipLink = {
    chipKey: "all",
    label: t("platform.filter.all"),
    href: tenantListHref({ ...query, status: undefined, page: 1 }),
    isActive: query.status === undefined,
  };
  const chips = TENANT_FILTER_STATUSES.map((status) => ({
    chipKey: status,
    label: t(`platform.status.organization.${status}`),
    href: tenantListHref({ ...query, status, page: 1 }),
    isActive: query.status === status,
  }));
  return [all, ...chips];
}

/** `/tenants`: find a tenant by name or slug, filter by status, open it (card 1.8b). */
export async function TenantsPage({
  searchParams,
}: {
  searchParams: RawParams;
}): Promise<ReactElement> {
  const [operator, translator] = await Promise.all([loadOperator(), getTranslator()]);
  const { t } = translator;
  if (!holdsPermission(operator, PLATFORM_PERMISSION_KEY.TENANT_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const query = parseTenantQuery(searchParams);
  const tenants = await fetchPlatformResource<PlatformOrganizationSummary[], PageMeta>(
    tenantsApiPath(query),
  );
  return (
    <PageLayout
      subtitle={t("platform.tenants.subtitle")}
      title={t("platform.tenants.title")}
      filters={
        <>
          <FilterChips chips={statusChips(query, t)} navLabel={t("platform.filter.label")} />
          <TenantSearch
            initialText={query.q ?? ""}
            status={query.status}
            label={t("platform.tenants.search")}
          />
        </>
      }
    >
      <TenantList
        rows={tenants.data.map((tenant) => toRow(tenant, translator))}
        labels={{
          name: t("platform.tenants.column.name"),
          slug: t("platform.tenants.column.slug"),
          template: t("platform.tenants.column.template"),
          status: t("platform.tenants.column.status"),
          subscription: t("platform.tenants.column.subscription"),
          members: t("platform.tenants.column.members"),
          empty: t("platform.tenants.empty"),
        }}
      />
      <ListPager
        page={query.page}
        hasNext={tenants.meta?.hasNext ?? false}
        previousHref={tenantListHref({ ...query, page: query.page - 1 })}
        nextHref={tenantListHref({ ...query, page: query.page + 1 })}
        labels={{
          previous: t("platform.page.previous"),
          next: t("platform.page.next"),
          current: t("platform.page.current", { page: formatCount(query.page, translator.locale) }),
        }}
      />
    </PageLayout>
  );
}

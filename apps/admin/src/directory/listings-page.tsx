import { PERMISSION_KEY } from "@banijjik/contracts";
import type { StaffListingListItem } from "@banijjik/contracts/directory";
import { EmptyState, PageLayout } from "@banijjik/ui";
import { termLabel } from "@banijjik/web-client";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { directoryListingsApiQuery, parseDirectoryListingsQuery } from "./directory-query";
import { DirectoryListingsFilterForm } from "./listings-filter-form";
import { DirectoryListingsPager, DirectoryListingsRows } from "./listings-list";

/** `/{orgSlug}/directory/listings`: filterable staff list. */
export async function DirectoryListingsPage(props: {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const access = await requireOrgAccess(props.orgSlug);
  const { t, locale } = await getTranslator();
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.DIRECTORY_LISTING_READ)) {
    return <EmptyState message={t("errors.forbidden")} />;
  }
  const query = parseDirectoryListingsQuery(props.searchParams);
  const basePath = `/${props.orgSlug}/directory/listings`;
  const list = await fetchBusinessResource<{
    items: StaffListingListItem[];
    total: number;
  }>(
    `/orgs/${access.organization.organizationId}/directory/listings?${directoryListingsApiQuery(query)}`,
  );
  const term = termLabel(access.config.terms, "listing", {
    locale,
    fallback: t("directory.term"),
  });
  return (
    <PageLayout
      title={t("directory.listings.title", { term })}
      subtitle={t("directory.listings.subtitle")}
    >
      <DirectoryListingsFilterForm query={query} t={t} />
      {list.data.items.length === 0 ? (
        <EmptyState message={t("directory.listings.empty", { term })} />
      ) : (
        <DirectoryListingsRows orgSlug={props.orgSlug} items={list.data.items} t={t} />
      )}
      <DirectoryListingsPager
        basePath={basePath}
        query={query}
        hasNext={query.page * 50 < list.data.total}
        t={t}
      />
    </PageLayout>
  );
}

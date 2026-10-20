import { PERMISSION_KEY } from "@banijjik/contracts";
import type { DirectoryConfigResponse, ListingResponse } from "@banijjik/contracts/directory";
import { EmptyState } from "@banijjik/ui";
import { organizationFileUrl, termLabel } from "@banijjik/web-client";
import type { ReactElement } from "react";
import { loadCurrency } from "../catalog/catalog-lookups";
import { API_BASE_URL } from "../config/api-base-url";
import { API_PREFIX } from "../lib/api/api-url";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess, type OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { reviewActionLabelsOf } from "./review-action-labels";
import { ListingReviewView } from "./listing-review-view";

function photoUrlsOf(organizationId: string, listing: ListingResponse): readonly string[] {
  return listing.photoFileIds.map((fileId) =>
    organizationFileUrl(
      { baseUrl: API_BASE_URL, apiPrefix: API_PREFIX },
      { organizationId, fileId, variant: "medium" },
    ),
  );
}

function reviewPermissions(access: OrgAccess): { canReview: boolean; canHide: boolean } {
  return {
    canReview:
      access.canWrite &&
      holdsPermission(access.config.permissions, PERMISSION_KEY.DIRECTORY_LISTING_REVIEW),
    canHide:
      access.canWrite &&
      holdsPermission(access.config.permissions, PERMISSION_KEY.DIRECTORY_LISTING_HIDE),
  };
}

/** `/{orgSlug}/directory/listings/[listingId]`: full review with checklist and actions. */
export async function ListingReviewPage(props: {
  orgSlug: string;
  listingId: string;
}): Promise<ReactElement> {
  const access = await requireOrgAccess(props.orgSlug);
  const { t, locale } = await getTranslator();
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.DIRECTORY_LISTING_READ)) {
    return <EmptyState message={t("errors.forbidden")} />;
  }
  const { organizationId } = access.organization;
  const [listingResult, configResult, currency] = await Promise.all([
    fetchBusinessResource<ListingResponse>(
      `/orgs/${organizationId}/directory/listings/${props.listingId}`,
    ),
    fetchBusinessResource<DirectoryConfigResponse>(`/orgs/${organizationId}/directory/config`),
    loadCurrency(access),
  ]);
  const { canReview, canHide } = reviewPermissions(access);
  return (
    <ListingReviewView
      listing={listingResult.data}
      config={configResult.data}
      fields={access.config.fields.listing ?? []}
      organizationId={organizationId}
      locale={locale}
      timeZone={access.timeZone}
      currencyCode={currency}
      t={t}
      term={termLabel(access.config.terms, "listing", { locale, fallback: t("directory.term") })}
      queueHref={`/${props.orgSlug}/directory/queue`}
      photoUrls={photoUrlsOf(organizationId, listingResult.data)}
      canReview={canReview}
      canHide={canHide}
      labels={reviewActionLabelsOf(t)}
    />
  );
}

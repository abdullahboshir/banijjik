import { PERMISSION_KEY, type EffectiveCustomField } from "@banijjik/contracts";
import type { DirectoryConfigResponse, ListingResponse } from "@banijjik/contracts/directory";
import { EmptyState, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { termLabel } from "@banijjik/web-client";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { QueueCard } from "./queue-card";

function firstSectionFields(
  fields: readonly EffectiveCustomField[],
  config: DirectoryConfigResponse,
): EffectiveCustomField[] {
  const firstKey = config.sections[0]?.sectionKey;
  if (firstKey === undefined) return [];
  return fields.filter((field) => field.sectionKey === firstKey);
}

/** `/{orgSlug}/directory/queue`: SUBMITTED listings, oldest first. */
export async function DirectoryQueuePage(props: { orgSlug: string }): Promise<ReactElement> {
  const access = await requireOrgAccess(props.orgSlug);
  const { t, locale } = await getTranslator();
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.DIRECTORY_LISTING_READ)) {
    return <EmptyState message={t("errors.forbidden")} />;
  }
  const { organizationId } = access.organization;
  const [queue, configResult] = await Promise.all([
    fetchBusinessResource<{ items: ListingResponse[]; total: number }>(
      `/orgs/${organizationId}/directory/queue?status=SUBMITTED&limit=50`,
    ),
    fetchBusinessResource<DirectoryConfigResponse>(`/orgs/${organizationId}/directory/config`),
  ]);
  const listingFields = access.config.fields.listing ?? [];
  const previewFields = firstSectionFields(listingFields, configResult.data);
  const term = termLabel(access.config.terms, "listing", {
    locale,
    fallback: t("directory.term"),
  });

  return (
    <PageLayout
      title={t("directory.queue.title", { term })}
      subtitle={t("directory.queue.subtitle", { count: String(queue.data.total), term })}
    >
      {queue.data.items.length === 0 ? (
        <EmptyState message={t("directory.queue.empty", { term })} />
      ) : (
        <ul className="flex flex-col gap-3">
          {queue.data.items.map((listing) => (
            <li key={listing.listingId}>
              <QueueCard
                listing={listing}
                href={`/${props.orgSlug}/directory/listings/${listing.listingId}`}
                previewFields={previewFields}
                locale={locale}
                labels={{
                  editedAfterApproval: t("directory.badge.editedAfterApproval"),
                  submittedAt: t("directory.field.submittedAt"),
                  open: t("directory.queue.open"),
                  status: (status) => t(`directory.status.${status}`),
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </PageLayout>
  );
}

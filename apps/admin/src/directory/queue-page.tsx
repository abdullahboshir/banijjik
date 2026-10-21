import { PERMISSION_KEY, type EffectiveCustomField } from "@banijjik/contracts";
import {
  LISTING_FIELD_TIER,
  type DirectoryConfigResponse,
  type ListingResponse,
} from "@banijjik/contracts/directory";
import type { Translator } from "@banijjik/i18n";
import { buttonVariants, EmptyState, PageLayout } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { termLabel } from "@banijjik/web-client";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { QueueCard } from "./queue-card";

const QUEUE_PAGE_LIMIT = 50;

function firstSectionFields(
  fields: readonly EffectiveCustomField[],
  config: DirectoryConfigResponse,
): EffectiveCustomField[] {
  const firstKey = config.sections[0]?.sectionKey;
  if (firstKey === undefined) return [];
  return fields.filter(
    (field) =>
      field.sectionKey === firstKey &&
      (field.listingTier ?? LISTING_FIELD_TIER.PUBLIC) === LISTING_FIELD_TIER.PUBLIC,
  );
}

function queuePageOf(searchParams: Record<string, string | string[] | undefined>): number {
  const raw = searchParams["page"];
  const first = Array.isArray(raw) ? raw[0] : raw;
  const page = Number(first ?? "1");
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

function QueuePager(props: {
  basePath: string;
  page: number;
  hasNext: boolean;
  t: Translator["t"];
}): ReactElement | null {
  if (props.page === 1 && !props.hasNext) return null;
  return (
    <div className="flex items-center justify-between gap-3">
      {props.page > 1 ? (
        <Link
          href={props.page === 2 ? props.basePath : `${props.basePath}?page=${props.page - 1}`}
          className={buttonVariants({ variant: "secondary" })}
        >
          {props.t("directory.page.previous")}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-small text-secondary">
        {props.t("directory.page.current", { page: String(props.page) })}
      </span>
      {props.hasNext ? (
        <Link
          href={`${props.basePath}?page=${props.page + 1}`}
          className={buttonVariants({ variant: "secondary" })}
        >
          {props.t("directory.page.next")}
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}

/** `/{orgSlug}/directory/queue`: SUBMITTED listings, oldest first. */
export async function DirectoryQueuePage(props: {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const access = await requireOrgAccess(props.orgSlug);
  const { t, locale } = await getTranslator();
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.DIRECTORY_LISTING_READ)) {
    return <EmptyState message={t("errors.forbidden")} />;
  }
  const { organizationId } = access.organization;
  const page = queuePageOf(props.searchParams);
  const basePath = `/${props.orgSlug}/directory/queue`;
  const [queue, configResult] = await Promise.all([
    fetchBusinessResource<{ items: ListingResponse[]; total: number }>(
      `/orgs/${organizationId}/directory/queue?status=SUBMITTED&page=${page}&limit=${QUEUE_PAGE_LIMIT}`,
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
      <QueuePager
        basePath={basePath}
        page={page}
        hasNext={page * QUEUE_PAGE_LIMIT < queue.data.total}
        t={t}
      />
    </PageLayout>
  );
}

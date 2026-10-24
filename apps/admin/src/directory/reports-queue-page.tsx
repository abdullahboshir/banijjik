import { PERMISSION_KEY } from "@banijjik/contracts";
import type {
  DirectoryConfigResponse,
  ListingReportQueueItem,
} from "@banijjik/contracts/directory";
import type { Locale, Translator } from "@banijjik/i18n";
import { buttonVariants, EmptyState, PageLayout } from "@banijjik/ui";
import { termLabel } from "@banijjik/web-client";
import Link from "next/link";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { reasonLabelOf } from "./report-reason-label";
import { ReportQueueCard, type ReportQueueCardLabels } from "./report-queue-card";
import { reportAgeOf, type ReportAge } from "./report-resolve-state";

const REPORT_QUEUE_LIMIT = 50;

function queuePageOf(searchParams: Record<string, string | string[] | undefined>): number {
  const raw = searchParams["page"];
  const first = Array.isArray(raw) ? raw[0] : raw;
  const page = Number(first ?? "1");
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

export function reportAgeText(t: Translator["t"], age: ReportAge): string {
  return t(`directory.reports.age.${age.unit}`, { count: String(age.count) });
}

function cardLabelsOf(
  t: Translator["t"],
  item: ListingReportQueueItem,
  context: { reasons: DirectoryConfigResponse["reportReasons"]; locale: Locale; now: Date },
): ReportQueueCardLabels {
  return {
    openCount: t("directory.reports.openCount", { count: String(item.openCount) }),
    reasons: t("directory.reports.reasons"),
    oldest: t("directory.reports.oldest"),
    open: t("directory.reports.open"),
    status: t(`directory.status.${item.listingStatus}`),
    reasonNames: item.reasonKeys.map((key) => reasonLabelOf(context.reasons, key, context.locale)),
    age: reportAgeText(t, reportAgeOf(item.oldestReportAt, context.now)),
  };
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

/** `/{orgSlug}/directory/reports`: listings with open reports, oldest first (M.7 decision 12). */
export async function ReportsQueuePage(props: {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const access = await requireOrgAccess(props.orgSlug);
  const { t, locale } = await getTranslator();
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.DIRECTORY_REPORT_READ)) {
    return <EmptyState message={t("errors.forbidden")} />;
  }
  const { organizationId } = access.organization;
  const page = queuePageOf(props.searchParams);
  const [queue, config] = await Promise.all([
    fetchBusinessResource<{ items: ListingReportQueueItem[]; total: number }>(
      `/orgs/${organizationId}/directory/reports?status=OPEN&page=${page}&limit=${REPORT_QUEUE_LIMIT}`,
    ),
    fetchBusinessResource<DirectoryConfigResponse>(`/orgs/${organizationId}/directory/config`),
  ]);
  const term = termLabel(access.config.terms, "listing", {
    locale,
    fallback: t("directory.term"),
  });
  const now = new Date();
  return (
    <PageLayout
      title={t("directory.reports.title", { term })}
      subtitle={t("directory.reports.subtitle", { count: String(queue.data.total), term })}
    >
      {queue.data.items.length === 0 ? (
        <EmptyState message={t("directory.reports.empty", { term })} />
      ) : (
        <ul className="flex flex-col gap-3">
          {queue.data.items.map((item) => (
            <li key={item.listingId}>
              <ReportQueueCard
                item={item}
                href={`/${props.orgSlug}/directory/reports/${item.listingId}`}
                labels={cardLabelsOf(t, item, { reasons: config.data.reportReasons, locale, now })}
              />
            </li>
          ))}
        </ul>
      )}
      <QueuePager
        basePath={`/${props.orgSlug}/directory/reports`}
        page={page}
        hasNext={page * REPORT_QUEUE_LIMIT < queue.data.total}
        t={t}
      />
    </PageLayout>
  );
}

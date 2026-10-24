import { PERMISSION_KEY, type CallerPermissionsResponse } from "@banijjik/contracts";
import {
  LISTING_REPORT_OUTCOME,
  type DirectoryConfigResponse,
  type ListingReportResponse,
  type ListingResponse,
} from "@banijjik/contracts/directory";
import type { Translator } from "@banijjik/i18n";
import { buttonVariants, EmptyState, PageLayout, StatusBadge } from "@banijjik/ui";
import { termLabel } from "@banijjik/web-client";
import Link from "next/link";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { LazyResolveReports } from "./lazy-resolve-reports";
import { reasonLabelOf } from "./report-reason-label";
import type { ResolveReportsLabels, ResolveReportsProps } from "./resolve-reports";

/** The resolve body carries at most this many ids, so the screen loads no more (API cap). */
const REPORTS_ON_SCREEN_LIMIT = 100;

function resolveLabelsOf(t: Translator["t"], term: string): ResolveReportsLabels {
  const outcomes = {} as Record<keyof typeof LISTING_REPORT_OUTCOME, string>;
  for (const outcome of Object.values(LISTING_REPORT_OUTCOME)) {
    outcomes[outcome] = t(`directory.reports.outcome.${outcome}`, { term });
  }
  return {
    open: t("directory.reports.resolve.open"),
    title: t("directory.reports.resolve.title"),
    outcome: t("directory.reports.resolve.outcome"),
    note: t("directory.reports.resolve.note"),
    submit: t("directory.reports.resolve.submit"),
    cancel: t("common.cancel"),
    close: t("shell.closeMenu"),
    stale: t("errors.directory_report_stale"),
    failure: t("errors.internal"),
    outcomes,
  };
}

function ReportRows(props: {
  reports: readonly ListingReportResponse[];
  config: DirectoryConfigResponse;
  locale: Parameters<typeof reasonLabelOf>[2];
  timeZone: string;
  t: Translator["t"];
}): ReactElement {
  const { t } = props;
  const when = new Intl.DateTimeFormat(props.locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: props.timeZone,
  });
  return (
    <ul className="flex flex-col gap-3">
      {props.reports.map((report) => (
        <li
          key={report.listingReportId}
          className="flex flex-col gap-1 rounded-md border border-default bg-surface p-4"
        >
          <span className="font-semibold">
            {reasonLabelOf(props.config.reportReasons, report.reasonKey, props.locale)}
          </span>
          <span className="text-small text-secondary">
            {t("directory.reports.reportedAt")}: {when.format(new Date(report.createdAt))}
          </span>
          {report.note === null ? null : (
            <p className="break-words text-small">
              <span className="text-secondary">{t("directory.reports.note")}: </span>
              {report.note}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function ReportDetailActions(props: {
  orgSlug: string;
  listing: ListingResponse;
  queueHref: string;
  term: string;
  t: Translator["t"];
}): ReactElement {
  const { t, listing, term } = props;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge
        requestType="LISTING"
        status={listing.status}
        label={t(`directory.status.${listing.status}`)}
      />
      <Link href={props.queueHref} className={buttonVariants({ variant: "secondary" })}>
        {t("directory.reports.backToReports")}
      </Link>
      <Link
        href={`/${props.orgSlug}/directory/listings/${listing.listingId}`}
        className={buttonVariants({ variant: "secondary" })}
      >
        {t("directory.reports.openListing", { term })}
      </Link>
    </div>
  );
}

async function loadReportDetail(
  organizationId: string,
  listingId: string,
): Promise<{
  listing: { data: ListingResponse };
  config: { data: DirectoryConfigResponse };
  reports: { data: { items: ListingReportResponse[] } };
}> {
  const base = `/orgs/${organizationId}/directory`;
  const [listing, config, reports] = await Promise.all([
    fetchBusinessResource<ListingResponse>(`${base}/listings/${listingId}`),
    fetchBusinessResource<DirectoryConfigResponse>(`${base}/config`),
    fetchBusinessResource<{ items: ListingReportResponse[] }>(
      `${base}/listings/${listingId}/reports?status=OPEN&page=1&limit=${REPORTS_ON_SCREEN_LIMIT}`,
    ),
  ]);
  return { listing, config, reports };
}

function resolveSectionProps(input: {
  organizationId: string;
  listingId: string;
  reports: readonly ListingReportResponse[];
  permissions: CallerPermissionsResponse;
  queueHref: string;
  labels: ResolveReportsLabels;
}): ResolveReportsProps {
  return {
    organizationId: input.organizationId,
    listingId: input.listingId,
    reportIds: input.reports.map((report) => report.listingReportId),
    canHide: holdsPermission(input.permissions, PERMISSION_KEY.DIRECTORY_LISTING_HIDE),
    canBlockAccounts: holdsPermission(
      input.permissions,
      PERMISSION_KEY.CONTACT_CUSTOMER_ACCOUNT_BLOCK,
    ),
    queueHref: input.queueHref,
    labels: input.labels,
  };
}

/** `/{orgSlug}/directory/reports/[listingId]`: open reports of one listing and the resolve sheet. */
export async function ReportDetailPage(props: {
  orgSlug: string;
  listingId: string;
}): Promise<ReactElement> {
  const access = await requireOrgAccess(props.orgSlug);
  const { t, locale } = await getTranslator();
  const permissions = access.config.permissions;
  if (
    !holdsPermission(permissions, PERMISSION_KEY.DIRECTORY_REPORT_READ) ||
    !holdsPermission(permissions, PERMISSION_KEY.DIRECTORY_LISTING_READ)
  ) {
    return <EmptyState message={t("errors.forbidden")} />;
  }
  const { organizationId } = access.organization;
  const { listing, config, reports } = await loadReportDetail(organizationId, props.listingId);
  const term = termLabel(access.config.terms, "listing", { locale, fallback: t("directory.term") });
  const canResolve =
    access.canWrite && holdsPermission(permissions, PERMISSION_KEY.DIRECTORY_REPORT_RESOLVE);
  const queueHref = `/${props.orgSlug}/directory/reports`;
  return (
    <PageLayout
      title={listing.data.listingNumber}
      subtitle={t("directory.reports.detail.subtitle", { term })}
      actions={
        <ReportDetailActions
          orgSlug={props.orgSlug}
          listing={listing.data}
          queueHref={queueHref}
          term={term}
          t={t}
        />
      }
    >
      {reports.data.items.length === 0 ? (
        <EmptyState message={t("directory.reports.detail.empty")} />
      ) : (
        <ReportRows
          reports={reports.data.items}
          config={config.data}
          locale={locale}
          timeZone={access.timeZone}
          t={t}
        />
      )}
      {canResolve && reports.data.items.length > 0 ? (
        <LazyResolveReports
          {...resolveSectionProps({
            organizationId,
            listingId: listing.data.listingId,
            reports: reports.data.items,
            permissions,
            queueHref,
            labels: resolveLabelsOf(t, term),
          })}
        />
      ) : null}
    </PageLayout>
  );
}

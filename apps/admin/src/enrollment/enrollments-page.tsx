import { PERMISSION_KEY } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import type { EnrollmentResponse } from "@banijjik/contracts/enrollment";
import { EmptyState, PageLayout } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { todayInTimeZone } from "../bookings/booking-query";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess, type OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { EnrollmentCard } from "./enrollment-card";
import { EnrollmentFilterForm, type EnrollmentFilterLabels } from "./enrollment-filter-form";
import {
  enrollmentStatusLabels,
  enrollmentWordsOf,
  type EnrollmentWords,
} from "./enrollment-labels";
import {
  enrollmentsQueryString,
  parseEnrollmentsQuery,
  type EnrollmentsQuery,
} from "./enrollment-query";
import {
  loadActiveLocations,
  loadContactNames,
  loadPlans,
  loadResourceChoices,
} from "./enrollment-lookups";
import { NewEnrollmentButton } from "./new-enrollment-button";
import { newEnrollmentLabelsOf } from "./new-enrollment-labels";

interface EnrollmentsPageProps {
  readonly orgSlug: string;
  readonly searchParams: Record<string, string | string[] | undefined>;
}

async function loadListData(access: OrgAccess, query: EnrollmentsQuery) {
  const organizationId = access.organization.organizationId;
  const [page, plans, locations, resources] = await Promise.all([
    fetchBusinessResource<EnrollmentResponse[], { hasNext?: boolean }>(
      `/orgs/${organizationId}/enrollments?${enrollmentsQueryString(query)}`,
    ),
    loadPlans(access),
    loadActiveLocations(access),
    loadResourceChoices(access),
  ]);
  const contactNames = await loadContactNames(
    access,
    page.data.map((row) => row.contactId),
  );
  return {
    rows: page.data,
    hasNext: page.meta?.hasNext === true,
    plans,
    locations,
    resources,
    contactNames,
  };
}

function PagerLinks(props: {
  basePath: string;
  query: EnrollmentsQuery;
  hasNext: boolean;
  labels: { previous: string; next: string };
}): ReactElement | null {
  const { basePath, query } = props;
  if (query.page === 1 && !props.hasNext) return null;
  const linkClass =
    "inline-flex min-h-11 items-center rounded-md border border-default px-4 text-body text-primary";
  return (
    <nav className="flex justify-between gap-3">
      {query.page > 1 ? (
        <Link
          className={linkClass}
          href={`${basePath}?${enrollmentsQueryString({ ...query, page: query.page - 1 })}`}
        >
          {props.labels.previous}
        </Link>
      ) : (
        <span />
      )}
      {props.hasNext ? (
        <Link
          className={linkClass}
          href={`${basePath}?${enrollmentsQueryString({ ...query, page: query.page + 1 })}`}
        >
          {props.labels.next}
        </Link>
      ) : null}
    </nav>
  );
}

function hasActiveFilter(query: EnrollmentsQuery): boolean {
  return query.status !== undefined || query.offeringId !== undefined || query.overdue;
}

function emptyMessageOf(input: {
  query: EnrollmentsQuery;
  words: EnrollmentWords;
  t: Translator["t"];
}): string {
  if (hasActiveFilter(input.query)) return input.t("enrollment.list.noMatch");
  return input.t("enrollment.list.empty", { term: input.words.enrollmentTerm });
}

type ListData = Awaited<ReturnType<typeof loadListData>>;
type Translate = Translator["t"];

function CreateButton(props: {
  access: OrgAccess;
  data: ListData;
  words: EnrollmentWords;
  t: Translate;
}): ReactElement | null {
  const { access, data, words, t } = props;
  const firstLocation = data.locations[0];
  const canCreate =
    access.canWrite &&
    holdsPermission(access.config.permissions, PERMISSION_KEY.ENROLLMENT_ENROLLMENT_CREATE) &&
    firstLocation !== undefined &&
    data.plans.length > 0;
  if (!canCreate) return null;
  return (
    <NewEnrollmentButton
      label={t("enrollment.list.add", { term: words.enrollmentTerm })}
      sheetProps={{
        organizationId: access.organization.organizationId,
        locationId: firstLocation.locationId,
        today: todayInTimeZone(access.timeZone),
        locations: data.locations.map(({ locationId, name }) => ({ locationId, name })),
        plans: data.plans,
        resources: data.resources,
        labels: newEnrollmentLabelsOf({ t, ...words }),
      }}
    />
  );
}

function filterLabelsOf(t: Translate, words: EnrollmentWords): EnrollmentFilterLabels {
  return {
    status: t("enrollment.filter.status"),
    statusAll: t("enrollment.filter.statusAll"),
    plan: words.planTerm,
    planAll: `${t("enrollment.filter.planAll")} ${words.planTerm}`,
    overdue: t("enrollment.filter.overdue"),
    apply: t("enrollment.filter.apply"),
    reset: t("enrollment.filter.reset"),
    statusNames: enrollmentStatusLabels(t),
  };
}

function EnrollmentCards(props: { basePath: string; data: ListData; t: Translate }): ReactElement {
  const { basePath, data, t } = props;
  const statusNames = enrollmentStatusLabels(t);
  const planNames = new Map(data.plans.map((plan) => [plan.offeringId, plan.name]));
  return (
    <ul className="flex flex-col gap-3">
      {data.rows.map((row) => (
        <EnrollmentCard
          key={row.enrollmentId}
          href={`${basePath}/${row.enrollmentId}`}
          enrollment={row}
          contactName={data.contactNames.get(row.contactId) ?? t("enrollment.list.unknownContact")}
          planName={planNames.get(row.offeringId) ?? t("enrollment.list.unknownPlan")}
          statusLabel={statusNames[row.status] ?? row.status}
          startsLabel={t("enrollment.list.starts", { date: row.startsOn })}
        />
      ))}
    </ul>
  );
}

export async function EnrollmentsPage(props: EnrollmentsPageProps): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  const { t } = translator;
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.ENROLLMENT_ENROLLMENT_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const words = enrollmentWordsOf(translator, access.config.terms);
  const query = parseEnrollmentsQuery(props.searchParams);
  const data = await loadListData(access, query);
  const basePath = `/${props.orgSlug}/enrollments`;
  return (
    <PageLayout
      title={t("menu.enrollment.enrollments")}
      subtitle={t("enrollment.list.subtitle")}
      actions={<CreateButton access={access} data={data} words={words} t={t} />}
      filters={
        <EnrollmentFilterForm
          basePath={basePath}
          query={query}
          plans={data.plans}
          labels={filterLabelsOf(t, words)}
        />
      }
    >
      {data.rows.length === 0 ? (
        <EmptyState kind="none" message={emptyMessageOf({ query, words, t })} />
      ) : (
        <EnrollmentCards basePath={basePath} data={data} t={t} />
      )}
      <PagerLinks
        basePath={basePath}
        query={query}
        hasNext={data.hasNext}
        labels={{ previous: t("enrollment.list.previous"), next: t("enrollment.list.next") }}
      />
    </PageLayout>
  );
}

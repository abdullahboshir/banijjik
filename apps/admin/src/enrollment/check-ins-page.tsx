import { PERMISSION_KEY } from "@banijjik/contracts";
import type { CheckInResponse } from "@banijjik/contracts/enrollment";
import { EmptyState, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { todayInTimeZone } from "../bookings/booking-query";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess, type OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { CheckInPanel } from "./check-in-panel";
import { loadActiveLocations, loadContactNames } from "./enrollment-lookups";

const LIST_LIMIT = 100;
const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

async function loadTodaysCheckIns(access: OrgAccess, locationId: string) {
  const organizationId = access.organization.organizationId;
  const { data: rows } = await fetchBusinessResource<CheckInResponse[]>(
    `/orgs/${organizationId}/check-ins?checkedInOn=${todayInTimeZone(access.timeZone)}&locationId=${locationId}&limit=${LIST_LIMIT}`,
  );
  const names = await loadContactNames(
    access,
    rows.map((row) => row.contactId),
  );
  return { rows, names };
}

function CheckInList(props: {
  rows: readonly CheckInResponse[];
  names: ReadonlyMap<string, string>;
  locale: string;
  timeZone: string;
  labels: { title: string; empty: string; unknown: string };
}): ReactElement {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-h3 font-semibold text-primary">{props.labels.title}</h2>
      {props.rows.length === 0 ? (
        <EmptyState kind="none" message={props.labels.empty} />
      ) : (
        <ul className="flex flex-col gap-2">
          {props.rows.map((row) => (
            <li
              key={row.checkInId}
              className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border border-default bg-surface px-4 py-2"
            >
              <span className="text-body text-primary">
                {props.names.get(row.contactId) ?? props.labels.unknown}
              </span>
              <span className="text-small text-secondary">
                {new Date(row.checkedInAt).toLocaleTimeString(props.locale, {
                  ...TIME_FORMAT,
                  timeZone: props.timeZone,
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export async function CheckInsPage(props: { orgSlug: string }): Promise<ReactElement> {
  const [{ t, locale }, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  const permissions = access.config.permissions;
  if (!holdsPermission(permissions, PERMISSION_KEY.ENROLLMENT_ENROLLMENT_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const title = t("menu.enrollment.checkIns");
  const subtitle = t("enrollment.checkIn.subtitle");
  const locationId = (await loadActiveLocations(access))[0]?.locationId;
  if (locationId === undefined) {
    return (
      <PageLayout title={title} subtitle={subtitle}>
        <EmptyState kind="none" message={t("enrollment.checkIn.noLocation")} />
      </PageLayout>
    );
  }
  const { rows, names } = await loadTodaysCheckIns(access, locationId);
  const canCheckIn =
    access.canWrite && holdsPermission(permissions, PERMISSION_KEY.ENROLLMENT_CHECK_IN_CREATE);
  return (
    <PageLayout title={title} subtitle={subtitle}>
      {canCheckIn ? (
        <CheckInPanel
          organizationId={access.organization.organizationId}
          locationId={locationId}
          labels={{ record: t("enrollment.checkIn.record"), done: t("enrollment.checkIn.done") }}
        />
      ) : null}
      <CheckInList
        rows={rows}
        names={names}
        locale={locale}
        timeZone={access.timeZone}
        labels={{
          title: t("enrollment.checkIn.today"),
          empty: t("enrollment.checkIn.empty"),
          unknown: t("enrollment.list.unknownContact"),
        }}
      />
    </PageLayout>
  );
}

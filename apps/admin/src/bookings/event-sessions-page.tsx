import { PERMISSION_KEY } from "@banijjik/contracts";
import { EmptyState, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import type { EventSessionView } from "./event-session-api";

export async function EventSessionsPage(props: { orgSlug: string }): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.BOOKING_EVENT_SESSION_READ))
    return <EmptyState kind="noPermission" message={translator.t("state.permissionDenied")} />;
  const sessions = (
    await fetchBusinessResource<EventSessionView[]>(
      `/orgs/${access.organization.organizationId}/event-sessions?limit=100`,
    )
  ).data;
  return (
    <PageLayout
      title={translator.t("menu.booking.eventSessions")}
      subtitle={translator.t("bookings.eventSessions.subtitle")}
    >
      <div className="flex flex-col gap-3">
        {sessions.map((session) => (
          <article
            key={session.eventSessionId}
            className="rounded-md border border-default bg-surface p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-primary">
                  {new Date(session.startsAt).toLocaleString(translator.locale)}
                </h2>
                <p className="text-small text-secondary">
                  {session.seatsSold} / {session.capacity}{" "}
                  {translator.t("bookings.eventSessions.seats")}
                </p>
              </div>
              <span className="text-small text-secondary">{session.status}</span>
            </div>
          </article>
        ))}
      </div>
    </PageLayout>
  );
}

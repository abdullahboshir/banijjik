import { PERMISSION_KEY, type PermissionKey } from "@banijjik/contracts";
import { EmptyState, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess, type OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { loadBookingLookups, loadEventOfferings } from "./booking-lookups";
import type { EventSessionView } from "./event-session-api";
import { EventSessionSheetButton } from "./event-session-buttons";
import { EventSessionList } from "./event-session-list";
import type { EventSessionSheetProps } from "./event-session-sheet";

const SESSION_PAGE_SIZE = 100;

type SheetBase = Omit<EventSessionSheetProps, "onClose" | "existing">;

async function loadSessionsScreen(access: OrgAccess): Promise<{
  sessions: EventSessionView[];
  names: Map<string, string>;
  sheetBase: SheetBase;
}> {
  const organizationId = access.organization.organizationId;
  const [sessions, offerings, lookups] = await Promise.all([
    fetchBusinessResource<EventSessionView[]>(
      `/orgs/${organizationId}/event-sessions?limit=${SESSION_PAGE_SIZE}`,
    ),
    loadEventOfferings(access),
    loadBookingLookups(access),
  ]);
  return {
    sessions: sessions.data,
    names: new Map(offerings.map((offering) => [offering.offeringId, offering.name])),
    sheetBase: {
      organizationId,
      timeZone: access.timeZone,
      offerings: offerings.map((offering) => ({
        offeringId: offering.offeringId,
        name: offering.name,
        variants: offering.variants.map((v) => ({ variantId: v.variantId, name: v.name })),
      })),
      locations: lookups.locations.map((l) => ({ locationId: l.locationId, name: l.name })),
      defaultLocationId: lookups.locations[0]?.locationId ?? "",
    },
  };
}

export async function EventSessionsPage(props: { orgSlug: string }): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  const { t, locale } = translator;
  const permissions = access.config.permissions;
  if (!holdsPermission(permissions, PERMISSION_KEY.BOOKING_EVENT_SESSION_READ))
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  const screen = await loadSessionsScreen(access);
  const mayDo = (key: PermissionKey): boolean =>
    access.canWrite && holdsPermission(permissions, key);
  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: access.timeZone,
  });
  const canCreate =
    mayDo(PERMISSION_KEY.BOOKING_EVENT_SESSION_CREATE) && screen.sheetBase.locations.length > 0;
  return (
    <PageLayout
      title={t("menu.booking.eventSessions")}
      subtitle={t("bookings.eventSessions.subtitle")}
      actions={
        canCreate ? (
          <EventSessionSheetButton
            label={t("bookings.eventSessions.add")}
            sheetProps={screen.sheetBase}
          />
        ) : null
      }
    >
      {screen.sessions.length === 0 ? (
        <EmptyState kind="none" message={t("bookings.eventSessions.empty")} />
      ) : (
        <EventSessionList
          organizationId={screen.sheetBase.organizationId}
          sessions={screen.sessions.map((session) => ({
            session,
            title: screen.names.get(session.offeringId) ?? session.offeringId,
            startsAtText: dateFormat.format(new Date(session.startsAt)),
            seatsSoldText: t("bookings.eventSessions.seatsSold", {
              sold: session.seatsSold,
              capacity: session.capacity,
            }),
            statusText: t(`bookings.eventSessions.status.${session.status}`),
          }))}
          editLabel={t("bookings.eventSessions.edit")}
          cancelLabel={t("bookings.eventSessions.cancel")}
          canUpdate={mayDo(PERMISSION_KEY.BOOKING_EVENT_SESSION_UPDATE)}
          canCancel={mayDo(PERMISSION_KEY.BOOKING_EVENT_SESSION_CANCEL)}
          sheetBase={screen.sheetBase}
        />
      )}
    </PageLayout>
  );
}

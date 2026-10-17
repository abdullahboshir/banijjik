import { LOCATION_STATUS, PERMISSION_KEY, type LocationResponse } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { EmptyState, PageHeader } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { termLabel } from "@banijjik/web-client";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermissionEverywhere, holdsPermission } from "../shell/permissions";
import { locationFormLabelsOf, locationTermOf } from "./location-labels";
import { LocationList, type LocationListLabels } from "./location-list";
import { toLocationRows } from "./location-rows";
import { NewLocationButton } from "./new-location-button";

const PAGE_SIZE = 100;
const CHIP_CLASS =
  "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-small transition-colors";

function parseStatus(value: string | string[] | undefined): LocationResponse["status"] {
  return value === LOCATION_STATUS.ARCHIVED ? LOCATION_STATUS.ARCHIVED : LOCATION_STATUS.ACTIVE;
}

function StatusChips({
  basePath,
  status,
  t,
}: {
  basePath: string;
  status: LocationResponse["status"];
  t: Translator["t"];
}): ReactElement {
  const chips = [
    { status: LOCATION_STATUS.ACTIVE, label: t("locations.filter.active") },
    { status: LOCATION_STATUS.ARCHIVED, label: t("locations.filter.archived") },
  ];
  return (
    <nav aria-label={t("locations.filter.label")} className="flex items-center gap-2">
      {chips.map((chip) => {
        const isActive = chip.status === status;
        return (
          <Link
            key={chip.status}
            href={`${basePath}?status=${chip.status}`}
            aria-current={isActive ? "true" : undefined}
            className={`${CHIP_CLASS} ${isActive ? "border-brand bg-brand text-on-brand" : "border-default bg-subtle text-primary"}`}
          >
            {chip.label}
          </Link>
        );
      })}
    </nav>
  );
}

function listLabelsOf(t: Translator["t"], term: string): LocationListLabels {
  return {
    name: t("locations.column.name"),
    type: t("locations.column.type"),
    phone: t("locations.column.phone"),
    status: t("locations.column.status"),
    actions: t("locations.column.actions"),
    edit: t("locations.edit"),
    archive: t("locations.archive"),
    defaultMark: t("locations.default"),
    empty: t("locations.empty", { term }),
  };
}

/** `/{orgSlug}/settings/locations`: the business places, one row each (13-UX section 4.1). */
export async function LocationsPage({
  orgSlug,
  searchParams,
}: {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [{ t, locale }, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { permissions, limits, terms } = access.config;
  if (!holdsPermission(permissions, PERMISSION_KEY.ORGANIZATION_LOCATION_READ)) {
    return <EmptyState message={t("state.permissionDenied")} />;
  }
  const status = parseStatus(searchParams["status"]);
  const { organizationId } = access.organization;
  const locations = await fetchBusinessResource<LocationResponse[]>(
    `/orgs/${organizationId}/locations?status=${status}&limit=${PAGE_SIZE}`,
  );
  const term = locationTermOf(terms, locale, t);
  const formLabels = locationFormLabelsOf(t, limits.locations, term);
  const canCreate =
    access.canWrite &&
    holdsPermissionEverywhere(permissions, PERMISSION_KEY.ORGANIZATION_LOCATION_CREATE);
  const abilities = {
    canUpdate:
      access.canWrite &&
      holdsPermissionEverywhere(permissions, PERMISSION_KEY.ORGANIZATION_LOCATION_UPDATE),
    canArchive:
      access.canWrite &&
      holdsPermissionEverywhere(permissions, PERMISSION_KEY.ORGANIZATION_LOCATION_ARCHIVE),
  };
  return (
    <>
      <PageHeader
        title={termLabel(terms, "location", { locale, fallback: t("locations.title") })}
        actions={
          canCreate ? (
            <NewLocationButton
              organizationId={organizationId}
              label={t("locations.add", { term })}
              labels={formLabels}
            />
          ) : null
        }
        filters={<StatusChips basePath={`/${orgSlug}/settings/locations`} status={status} t={t} />}
      />
      <LocationList
        organizationId={organizationId}
        rows={toLocationRows(locations.data, abilities, t)}
        labels={listLabelsOf(t, term)}
        formLabels={formLabels}
      />
    </>
  );
}

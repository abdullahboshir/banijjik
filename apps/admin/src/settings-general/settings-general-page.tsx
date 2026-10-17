import { PERMISSION_KEY, type LocationResponse, type SettingsResponse } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { EmptyState, PageHeader } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess, type OrgAccess } from "../shell/org-access";
import {
  holdsPermission,
  holdsPermissionAt,
  holdsPermissionEverywhere,
} from "../shell/permissions";
import { SettingList } from "./setting-list";
import { settingListLabelsOf, settingSheetLabelsOf } from "./setting-labels";
import { toSettingRows } from "./setting-rows";

const LOCATION_PAGE_SIZE = 100;
const CHIP_CLASS =
  "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-small transition-colors";

function LevelChips({
  basePath,
  locations,
  selectedId,
  t,
}: {
  basePath: string;
  locations: readonly LocationResponse[];
  selectedId: string | undefined;
  t: Translator["t"];
}): ReactElement {
  const chips = [
    { id: undefined, label: t("settings.general.level.business"), href: basePath },
    ...locations.map((location) => ({
      id: location.locationId,
      label: location.name,
      href: `${basePath}?location=${location.locationId}`,
    })),
  ];
  return (
    <nav
      aria-label={t("settings.general.level.label")}
      className="flex items-center gap-2 overflow-x-auto"
    >
      {chips.map((chip) => {
        const isActive = chip.id === selectedId;
        return (
          <Link
            key={chip.id ?? "business"}
            href={chip.href}
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

function canChange(access: OrgAccess, locationId: string | undefined): boolean {
  if (!access.canWrite) return false;
  const { permissions } = access.config;
  const key = PERMISSION_KEY.SETTINGS_SETTING_UPDATE;
  if (locationId === undefined) return holdsPermissionEverywhere(permissions, key);
  return holdsPermissionAt(permissions, key, locationId);
}

function chosenLocationId(
  value: string | string[] | undefined,
  locations: readonly LocationResponse[],
): string | undefined {
  return locations.find((location) => location.locationId === value)?.locationId;
}

/** Locations are only worth a filter when at least one setting can differ by location. */
function placesOf(
  settings: SettingsResponse,
  locations: readonly LocationResponse[] | undefined,
): readonly LocationResponse[] {
  const hasOverridable = Object.values(settings.definitions).some(
    (definition) => definition.allowsLocationOverride,
  );
  return hasOverridable ? (locations ?? []) : [];
}

async function fetchLocationSettings(
  organizationId: string,
  locationId: string,
): Promise<SettingsResponse> {
  const result = await fetchBusinessResource<SettingsResponse>(
    `/orgs/${organizationId}/settings?location=${locationId}`,
  );
  return result.data;
}

/**
 * `/{orgSlug}/settings/general`: the resolved settings and where each value comes from. A setting that
 * allows a location override can be edited per location through the `?location=` page filter (ADR-004).
 */
export async function SettingsGeneralPage({
  orgSlug,
  searchParams,
}: {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [{ t }, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.SETTINGS_SETTING_READ)) {
    return <EmptyState message={t("state.permissionDenied")} />;
  }
  const { organizationId } = access.organization;
  const [business, locations] = await Promise.all([
    fetchBusinessResource<SettingsResponse>(`/orgs/${organizationId}/settings`),
    fetchBusinessResourceIfAllowed<LocationResponse[]>(
      `/orgs/${organizationId}/locations?status=ACTIVE&limit=${LOCATION_PAGE_SIZE}`,
    ),
  ]);
  const places = placesOf(business.data, locations);
  const locationId = chosenLocationId(searchParams["location"], places);
  const shown =
    locationId === undefined
      ? business.data
      : await fetchLocationSettings(organizationId, locationId);
  const rows = toSettingRows({
    response: shown,
    locationId,
    canEdit: canChange(access, locationId),
    t,
  });
  return (
    <>
      <PageHeader
        title={t("settings.general.title")}
        filters={
          places.length > 1 ? (
            <LevelChips
              basePath={`/${orgSlug}/settings/general`}
              locations={places}
              selectedId={locationId}
              t={t}
            />
          ) : undefined
        }
      />
      <SettingList
        organizationId={organizationId}
        rows={rows}
        labels={settingListLabelsOf(t)}
        sheetLabels={settingSheetLabelsOf(t)}
      />
    </>
  );
}

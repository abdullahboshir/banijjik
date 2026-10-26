import {
  LIMIT_KEY,
  LOCATION_STATUS,
  PERMISSION_KEY,
  type LocationResponse,
} from "@banijjik/contracts";
import type { PosDeviceResponse, PosDeviceUsageResponse } from "@banijjik/contracts/pos";
import type { Locale } from "@banijjik/i18n";
import { EmptyState, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { PageMeta } from "../lib/api/page-meta";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess, type OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { PosDeviceAddButton } from "./pos-device-add-button";
import { PosDeviceList } from "./pos-device-list";
import {
  deviceAddLabelsOf,
  deviceRevokeLabelsOf,
  devicesFilterLabelsOf,
  devicesListLabelsOf,
} from "./pos-devices-labels";
import { PosDevicesLocationChips, PosDevicesPager } from "./pos-devices-nav";
import { parsePosDevicesQuery, posDevicesApiPath, type PosDevicesQuery } from "./pos-devices-query";
import { canAddDevice, toDeviceRows, usageTextOf, type Translate } from "./pos-devices-view";

const LOOKUP_LIMIT = 100;

interface DevicesPageData {
  readonly usage: PosDeviceUsageResponse;
  readonly devices: { data: PosDeviceResponse[]; meta?: PageMeta };
  readonly locations: LocationResponse[];
}

async function loadPageData(access: OrgAccess, query: PosDevicesQuery): Promise<DevicesPageData> {
  const { organizationId } = access.organization;
  const [usage, devices, locations] = await Promise.all([
    fetchBusinessResource<PosDeviceUsageResponse>(`/orgs/${organizationId}/pos/devices/usage`),
    fetchBusinessResource<PosDeviceResponse[], PageMeta>(posDevicesApiPath(organizationId, query)),
    fetchBusinessResourceIfAllowed<LocationResponse[]>(
      `/orgs/${organizationId}/locations?status=${LOCATION_STATUS.ACTIVE}&limit=${LOOKUP_LIMIT}`,
    ),
  ]);
  return { usage: usage.data, devices, locations: locations ?? [] };
}

/** The first location in the filter, or the location the page is filtered to. */
function defaultLocationOf(
  query: PosDevicesQuery,
  locations: readonly LocationResponse[],
): string | undefined {
  if (query.locationId) return query.locationId;
  return locations[0]?.locationId;
}

function locationNamesOf(locations: readonly LocationResponse[]): Map<string, string> {
  return new Map(locations.map((location) => [location.locationId, location.name]));
}

interface BodyProps {
  readonly access: OrgAccess;
  readonly basePath: string;
  readonly query: PosDevicesQuery;
  readonly data: DevicesPageData;
  readonly limit: number | null;
  readonly t: Translate;
  readonly locale: Locale;
}

/** "2 of 3 devices used", and the limit notice under it when the package is full. */
function UsageNotice(props: { usageText: string; limitNotice: string | undefined }): ReactElement {
  return (
    <>
      <p className="mb-3 text-small text-secondary">{props.usageText}</p>
      {props.limitNotice ? (
        <p role="alert" className="mb-3 text-small text-danger">
          {props.limitNotice}
        </p>
      ) : null}
    </>
  );
}

/** The usage line, the add button, the list and the pager of the devices screen. */
function PosDevicesBody(props: BodyProps): ReactElement {
  const { access, basePath, query, data, limit, t, locale } = props;
  const { organizationId } = access.organization;
  const isFull = !canAddDevice(data.usage.activeDeviceCount, limit);
  const locationOptions = data.locations.map((location) => ({
    locationId: location.locationId,
    name: location.name,
  }));
  const rows = toDeviceRows(data.devices.data, {
    locationNames: locationNamesOf(data.locations),
    t,
    format: { locale, timeZone: access.timeZone },
  });
  const canManage = access.canWrite;
  return (
    <PageLayout
      title={t("posDevices.title")}
      subtitle={t("posDevices.subtitle")}
      actions={
        canManage ? (
          <PosDeviceAddButton
            organizationId={organizationId}
            labels={deviceAddLabelsOf(t, limit)}
            locations={locationOptions}
            defaultLocationId={defaultLocationOf(query, data.locations)}
            isOff={isFull}
          />
        ) : null
      }
      filters={
        <PosDevicesLocationChips
          basePath={basePath}
          locations={locationOptions}
          selectedLocationId={query.locationId}
          labels={devicesFilterLabelsOf(t)}
        />
      }
    >
      <UsageNotice
        usageText={usageTextOf(data.usage.activeDeviceCount, limit, t)}
        limitNotice={canManage && isFull ? deviceAddLabelsOf(t, limit).limitReached : undefined}
      />
      <PosDeviceList
        organizationId={organizationId}
        rows={rows}
        labels={devicesListLabelsOf(t)}
        revokeLabels={deviceRevokeLabelsOf(t)}
        mayRevoke={canManage}
      />
      <PosDevicesPager
        basePath={basePath}
        query={query}
        hasNext={data.devices.meta?.hasNext === true}
        labels={devicesFilterLabelsOf(t)}
        pageText={t("posDevices.page.current", { page: query.page })}
      />
    </PageLayout>
  );
}

/** `/{orgSlug}/settings/pos-devices`: the tills of the business, the usage line and the add sheet. */
export async function PosDevicesPage(props: {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  const { t, locale } = translator;
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.POS_DEVICE_MANAGE)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const query = parsePosDevicesQuery(props.searchParams);
  const data = await loadPageData(access, query);
  return (
    <PosDevicesBody
      access={access}
      basePath={`/${props.orgSlug}/settings/pos-devices`}
      query={query}
      data={data}
      limit={access.config.limits[LIMIT_KEY.POS_DEVICES]}
      t={t}
      locale={locale}
    />
  );
}

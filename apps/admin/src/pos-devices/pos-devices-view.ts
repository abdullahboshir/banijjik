import { POS_DEVICE_STATUS, type PosDeviceResponse } from "@banijjik/contracts/pos";
import type { Locale, Translator } from "@banijjik/i18n";

export type Translate = Translator["t"];

/** One row of the devices list, ready for the card. The state is a sentence, not a code. */
export interface PosDeviceRowView {
  readonly posDeviceId: string;
  readonly version: number;
  readonly name: string;
  readonly locationName: string;
  readonly stateText: string;
  /** A revoked device has nothing left to revoke. */
  readonly canRevoke: boolean;
}

/**
 * Whether one more device fits the package. `limit` comes from `/me/config` (`null` = unlimited);
 * the screen never copies the limit rule, the API still refuses an add at the limit (422).
 */
export function canAddDevice(activeDeviceCount: number, limit: number | null): boolean {
  return limit === null || activeDeviceCount < limit;
}

export function usageTextOf(used: number, limit: number | null, t: Translate): string {
  if (limit === null) return t("posDevices.usageUnlimited", { used });
  return t("posDevices.usage", { used, limit });
}

/**
 * How a device time is written. The list renders on the server, whose zone is not the business's,
 * so the zone is always given: the business zone for the list, the browser's for the client sheet.
 */
export interface DeviceTimeFormat {
  readonly locale: Locale;
  readonly timeZone: string;
}

export function deviceTimeTextOf(isoTime: string, format: DeviceTimeFormat): string {
  return new Intl.DateTimeFormat(format.locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: format.timeZone,
  }).format(new Date(isoTime));
}

/**
 * The state of one device. A paired device stays paired; a waiting one still has its code; an
 * active device with no code and no pairing has an expired code and can only be revoked.
 */
export function deviceStateTextOf(
  device: PosDeviceResponse,
  t: Translate,
  format: DeviceTimeFormat,
): string {
  if (device.status === POS_DEVICE_STATUS.REVOKED) return t("posDevices.state.revoked");
  if (device.pairedAt !== null) return pairedTextOf(device, t, format);
  if (device.isAwaitingPairing) return t("posDevices.state.waiting");
  return t("posDevices.state.codeExpired");
}

function pairedTextOf(device: PosDeviceResponse, t: Translate, format: DeviceTimeFormat): string {
  if (device.lastSeenAt === null) return t("posDevices.state.paired");
  return t("posDevices.state.pairedSeen", { time: deviceTimeTextOf(device.lastSeenAt, format) });
}

export interface DeviceRowContext {
  readonly locationNames: ReadonlyMap<string, string>;
  readonly t: Translate;
  readonly format: DeviceTimeFormat;
}

/**
 * The list rows. A location missing from the lookup (it is outside the caller's locations) shows its
 * id, so no row is left blank.
 */
export function toDeviceRows(
  devices: readonly PosDeviceResponse[],
  context: DeviceRowContext,
): PosDeviceRowView[] {
  return devices.map((device) => ({
    posDeviceId: device.posDeviceId,
    version: device.version,
    name: device.name,
    locationName: context.locationNames.get(device.locationId) ?? device.locationId,
    stateText: deviceStateTextOf(device, context.t, context.format),
    canRevoke: device.status !== POS_DEVICE_STATUS.REVOKED,
  }));
}

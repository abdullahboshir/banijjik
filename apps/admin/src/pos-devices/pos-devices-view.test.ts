import { POS_DEVICE_STATUS, type PosDeviceResponse } from "@banijjik/contracts/pos";
import { createTranslator, SCREEN_CATALOGS } from "@banijjik/i18n";
import { describe, expect, it } from "vitest";
import { canAddDevice, deviceStateTextOf, toDeviceRows, usageTextOf } from "./pos-devices-view";

const LOCATION_ID = "0190a6a0-0000-7000-8000-000000000001";
const OTHER_LOCATION_ID = "0190a6a0-0000-7000-8000-000000000002";
const LAST_SEEN = "2026-10-26T04:30:00.000Z";

const t = createTranslator({ locale: "en", brandName: "Example", catalogs: SCREEN_CATALOGS }).t;

function deviceOf(overrides: Partial<PosDeviceResponse>): PosDeviceResponse {
  return {
    posDeviceId: "0190a6a0-0000-7000-8000-0000000000aa",
    locationId: LOCATION_ID,
    name: "Counter 1",
    status: POS_DEVICE_STATUS.ACTIVE,
    pairedAt: null,
    lastSeenAt: null,
    isAwaitingPairing: false,
    version: 1,
    createdAt: "2026-10-26T04:00:00.000Z",
    ...overrides,
  };
}

describe("the usage line", () => {
  it("shows the devices used against the package limit", () => {
    expect(usageTextOf(1, 3, t)).toBe("1 of 3 devices used");
  });

  it("says there is no limit when the package has none", () => {
    expect(usageTextOf(4, null, t)).toBe("4 devices used, no limit");
  });
});

describe("the add button rule", () => {
  it("allows one more device only while the count is below the limit", () => {
    expect(canAddDevice(0, 1)).toBe(true);
    expect(canAddDevice(1, 1)).toBe(false);
  });

  it("never refuses an add when the package is unlimited", () => {
    expect(canAddDevice(50, null)).toBe(true);
  });
});

describe("the state of a device", () => {
  it("says a paired device is paired and shows when it was last seen", () => {
    const text = deviceStateTextOf(
      deviceOf({ pairedAt: LAST_SEEN, lastSeenAt: LAST_SEEN }),
      t,
      "en",
    );
    expect(text.startsWith("Paired, last seen ")).toBe(true);
  });

  it("says a paired device that was never seen is only paired", () => {
    expect(deviceStateTextOf(deviceOf({ pairedAt: LAST_SEEN }), t, "en")).toBe("Paired");
  });

  it("says an active device with a live code is waiting for pairing", () => {
    expect(deviceStateTextOf(deviceOf({ isAwaitingPairing: true }), t, "en")).toBe(
      "Waiting for pairing",
    );
  });

  it("says an active device with no code and no pairing has an expired code", () => {
    expect(deviceStateTextOf(deviceOf({}), t, "en")).toBe("Code expired");
  });

  it("says a revoked device is revoked, even when it was paired", () => {
    const revoked = deviceOf({ status: POS_DEVICE_STATUS.REVOKED, pairedAt: LAST_SEEN });
    expect(deviceStateTextOf(revoked, t, "en")).toBe("Revoked");
  });
});

describe("the device rows", () => {
  it("offers Revoke on an active device and never on a revoked one", () => {
    const rows = toDeviceRows(
      [deviceOf({}), deviceOf({ posDeviceId: "b", status: POS_DEVICE_STATUS.REVOKED })],
      { locationNames: new Map([[LOCATION_ID, "Main store"]]), t, locale: "en" },
    );
    expect(rows.map((row) => row.canRevoke)).toEqual([true, false]);
  });

  it("names the location of each device, or shows its id when the caller cannot see it", () => {
    const rows = toDeviceRows(
      [deviceOf({ locationId: LOCATION_ID }), deviceOf({ locationId: OTHER_LOCATION_ID })],
      { locationNames: new Map([[LOCATION_ID, "Main store"]]), t, locale: "en" },
    );
    expect(rows.map((row) => row.locationName)).toEqual(["Main store", OTHER_LOCATION_ID]);
  });
});

import { describe, expect, it } from "vitest";
import { buildLocationCreate, buildLocationUpdate } from "./location-form";
import { EMPTY_LOCATION_FORM, type LocationFormState } from "./location-state";

const SAVED: LocationFormState = {
  ...EMPTY_LOCATION_FORM,
  name: "Mirpur Shop",
  locationPhone: "01712-345678",
  timezone: "Asia/Dhaka",
  line1: "12 Park Road",
};

describe("buildLocationUpdate when a filled optional field is emptied", () => {
  it("sends null for each emptied field and keeps the name and type", () => {
    const edited = { ...SAVED, locationPhone: "", timezone: "", line1: "" };

    const result = buildLocationUpdate(edited, 5, SAVED);

    expect(result).toEqual({
      ok: true,
      body: {
        name: "Mirpur Shop",
        locationType: "STORE",
        phoneE164: null,
        timezone: null,
        address: null,
        version: 5,
      },
    });
  });

  it("leaves out an optional field that was empty and still is", () => {
    const empty = { ...SAVED, locationPhone: "", timezone: "", line1: "" };

    const result = buildLocationUpdate(empty, 5, empty);

    expect(result.ok && Object.keys(result.body).sort()).toEqual([
      "locationType",
      "name",
      "version",
    ]);
  });

  it("never sends null for the name, which is required", () => {
    const result = buildLocationUpdate({ ...SAVED, name: "" }, 5, SAVED);

    expect(result.ok).toBe(false);
  });
});

describe("buildLocationCreate", () => {
  it("never sends null: a new location has nothing to clear", () => {
    const result = buildLocationCreate({ ...EMPTY_LOCATION_FORM, name: "Uttara Shop" });

    expect(result).toEqual({ ok: true, body: { name: "Uttara Shop", locationType: "STORE" } });
  });
});

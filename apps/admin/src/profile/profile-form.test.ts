import { describe, expect, it } from "vitest";
import { buildProfileUpdate } from "./profile-form";
import type { ProfileFormState } from "./profile-state";

const FORM: ProfileFormState = {
  name: "Rahim Traders",
  defaultLocale: "bn",
  legalName: "",
  legalType: "",
  businessPhone: "",
  businessEmail: "",
  line1: "",
  area: "",
  thana: "",
  district: "",
  postalCode: "",
  tradeLicenseNumber: "",
};

describe("buildProfileUpdate", () => {
  it("sends the version it was given and leaves empty fields out", () => {
    const result = buildProfileUpdate(FORM, 7);

    expect(result).toEqual({
      ok: true,
      body: { name: "Rahim Traders", defaultLocale: "bn", version: 7 },
    });
  });

  it("turns a typed local phone number into E.164", () => {
    const result = buildProfileUpdate({ ...FORM, businessPhone: "01712-345678" }, 1);

    expect(result.ok && result.body.profile?.phoneE164).toBe("+8801712345678");
  });

  it("groups the address parts into one address", () => {
    const result = buildProfileUpdate({ ...FORM, line1: "12 Park Road", district: "Dhaka" }, 1);

    expect(result.ok && result.body.profile?.address).toEqual({
      line1: "12 Park Road",
      district: "Dhaka",
    });
  });

  it("reports a missing name as required on the name field", () => {
    const result = buildProfileUpdate({ ...FORM, name: "  " }, 1);

    expect(result).toEqual({ ok: false, fieldErrors: { name: "validation.required" } });
  });

  it("reports a bad phone number and a bad email on their own fields", () => {
    const result = buildProfileUpdate(
      { ...FORM, businessPhone: "12345", businessEmail: "not-an-email" },
      1,
    );

    expect(!result.ok && Object.keys(result.fieldErrors).sort()).toEqual([
      "businessEmail",
      "businessPhone",
    ]);
  });
});

import { newId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { locationUpdateRequestSchema } from "./location.schema.js";
import { invitationCreateRequestSchema, memberUpdateRequestSchema } from "./member.schema.js";
import { profileUpdateRequestSchema } from "./profile.schema.js";

const ASSIGNMENT = { locationId: "ALL", roleId: newId() };

describe("invitationCreateRequestSchema", () => {
  it("accepts an email and normalizes it", () => {
    const parsed = invitationCreateRequestSchema.parse({
      email: " Rahim@Example.com ",
      assignments: [ASSIGNMENT],
    });

    expect(parsed.email).toBe("rahim@example.com");
  });

  it("normalizes a local phone number to E.164", () => {
    const parsed = invitationCreateRequestSchema.parse({
      phone: "01712345678",
      assignments: [ASSIGNMENT],
    });

    expect(parsed.phone).toBe("+8801712345678");
  });

  it.each([
    ["neither email nor phone", { assignments: [ASSIGNMENT] }],
    ["both email and phone", { email: "a@b.co", phone: "01712345678", assignments: [ASSIGNMENT] }],
    ["no assignments", { email: "a@b.co", assignments: [] }],
    [
      "a location that is neither ALL nor an id",
      { email: "a@b.co", assignments: [{ locationId: "x", roleId: newId() }] },
    ],
  ])("rejects %s", (_description, body) => {
    expect(invitationCreateRequestSchema.safeParse(body).success).toBe(false);
  });
});

describe("update schemas", () => {
  it("rejects a member update that changes nothing", () => {
    expect(memberUpdateRequestSchema.safeParse({ version: 1 }).success).toBe(false);
  });

  it("rejects a location update with an unknown timezone", () => {
    const result = locationUpdateRequestSchema.safeParse({ timezone: "Mars/Base", version: 1 });

    expect(result.success).toBe(false);
  });

  it("rejects profile fields that are not editable, such as the slug", () => {
    const result = profileUpdateRequestSchema.safeParse({ slug: "new-slug", version: 1 });

    expect(result.success).toBe(false);
  });

  it("requires the version", () => {
    expect(profileUpdateRequestSchema.safeParse({ name: "New name" }).success).toBe(false);
  });
});

describe("clearing optional fields with null", () => {
  it("accepts null on every optional profile field and on the whole address", () => {
    const result = profileUpdateRequestSchema.safeParse({
      profile: {
        legalName: null,
        legalType: null,
        phoneE164: null,
        email: null,
        address: null,
        tradeLicenseNumber: null,
      },
      version: 1,
    });

    expect(result.success).toBe(true);
  });

  it("rejects null on the required profile fields and on a profile that is not an object", () => {
    expect(profileUpdateRequestSchema.safeParse({ name: null, version: 1 }).success).toBe(false);
    expect(profileUpdateRequestSchema.safeParse({ defaultLocale: null, version: 1 }).success).toBe(
      false,
    );
    expect(profileUpdateRequestSchema.safeParse({ profile: null, version: 1 }).success).toBe(false);
  });

  it("accepts null on the optional location fields and rejects it on the required ones", () => {
    const cleared = locationUpdateRequestSchema.safeParse({
      address: null,
      phoneE164: null,
      timezone: null,
      version: 1,
    });

    expect(cleared.success).toBe(true);
    expect(locationUpdateRequestSchema.safeParse({ name: null, version: 1 }).success).toBe(false);
    expect(locationUpdateRequestSchema.safeParse({ locationType: null, version: 1 }).success).toBe(
      false,
    );
  });

  it("still validates a value that is given", () => {
    expect(
      locationUpdateRequestSchema.safeParse({ timezone: "Mars/Base", version: 1 }).success,
    ).toBe(false);
  });
});

describe("customFields in the profile and member updates", () => {
  it("accepts an object of values, including null, and keeps the values unchecked for the use case", () => {
    const profile = profileUpdateRequestSchema.parse({
      customFields: { branch_code: "DHK-01", closed_on: null, any_shape: { nested: true } },
      version: 1,
    });
    const member = memberUpdateRequestSchema.parse({
      customFields: { nid: "123" },
      version: 1,
    });

    expect(profile.customFields).toEqual({
      branch_code: "DHK-01",
      closed_on: null,
      any_shape: { nested: true },
    });
    expect(member.customFields).toEqual({ nid: "123" });
  });

  it("lets customFields be the only change besides the version", () => {
    expect(
      profileUpdateRequestSchema.safeParse({ customFields: { a: "1" }, version: 1 }).success,
    ).toBe(true);
    expect(
      memberUpdateRequestSchema.safeParse({ customFields: { a: "1" }, version: 1 }).success,
    ).toBe(true);
  });

  it("refuses a list, a text and a flood of keys", () => {
    const flood = Object.fromEntries(
      Array.from({ length: 101 }, (_, index) => [`key_${index}`, "x"]),
    );

    for (const customFields of [["a"], "a", flood]) {
      expect(profileUpdateRequestSchema.safeParse({ customFields, version: 1 }).success).toBe(
        false,
      );
      expect(memberUpdateRequestSchema.safeParse({ customFields, version: 1 }).success).toBe(false);
    }
  });
});

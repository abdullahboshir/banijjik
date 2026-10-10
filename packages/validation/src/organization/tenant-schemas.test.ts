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

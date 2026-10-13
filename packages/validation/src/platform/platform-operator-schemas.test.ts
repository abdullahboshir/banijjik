import { newId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import {
  platformOperatorCreateRequestSchema,
  platformOperatorListQuerySchema,
  platformOperatorParamsSchema,
  platformOperatorStatusRequestSchema,
  platformOperatorUpdateRequestSchema,
} from "./platform-operator-schemas.js";

const REASON = "handed the billing queue";

describe("platform operator schemas", () => {
  it("reads an optional status and the shared page", () => {
    expect(platformOperatorListQuerySchema.parse({ status: "DISABLED", page: "2" })).toEqual({
      status: "DISABLED",
      page: 2,
      limit: 20,
    });
  });

  it("accepts an email or a phone number and one to three distinct roles", () => {
    const email = platformOperatorCreateRequestSchema.parse({
      identifier: " Rahim@Example.com ",
      platformRoles: ["SUPPORT", "BILLING"],
      reason: REASON,
    });
    const phone = platformOperatorCreateRequestSchema.parse({
      identifier: "01712-345678",
      platformRoles: ["SUPER_ADMIN", "SUPPORT", "BILLING"],
      reason: REASON,
    });

    expect(email.identifier).toEqual({ kind: "EMAIL", value: "rahim@example.com" });
    expect(phone.identifier.kind).toBe("PHONE");
  });

  it("refuses an empty role list, a duplicate, an unknown role, a missing reason and an extra key", () => {
    const parse = (body: object) => platformOperatorCreateRequestSchema.safeParse(body).success;
    expect(parse({ identifier: "a@b.co", platformRoles: [], reason: REASON })).toBe(false);
    expect(
      parse({ identifier: "a@b.co", platformRoles: ["SUPPORT", "SUPPORT"], reason: REASON }),
    ).toBe(false);
    expect(parse({ identifier: "a@b.co", platformRoles: ["OWNER"], reason: REASON })).toBe(false);
    expect(parse({ identifier: "a@b.co", platformRoles: ["SUPPORT"] })).toBe(false);
    expect(
      parse({ identifier: "a@b.co", platformRoles: ["SUPPORT"], reason: REASON, extra: 1 }),
    ).toBe(false);
  });

  it("requires a positive version on a role change and a status change", () => {
    const roles = { platformRoles: ["BILLING"], version: 2, reason: REASON };
    expect(platformOperatorUpdateRequestSchema.parse(roles).version).toBe(2);
    expect(platformOperatorUpdateRequestSchema.safeParse({ ...roles, version: 0 }).success).toBe(
      false,
    );
    expect(platformOperatorStatusRequestSchema.parse({ version: 1, reason: REASON }).version).toBe(
      1,
    );
  });

  it("requires a UUID v7 operator id", () => {
    expect(platformOperatorParamsSchema.safeParse({ platformOperatorId: newId() }).success).toBe(
      true,
    );
    expect(platformOperatorParamsSchema.safeParse({ platformOperatorId: "nope" }).success).toBe(
      false,
    );
  });
});

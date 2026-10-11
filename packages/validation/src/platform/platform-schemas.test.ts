import { LIMIT_KEY_VALUES } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import {
  platformChangePackageRequestSchema,
  platformExtendTrialRequestSchema,
  platformModuleOverrideCreateRequestSchema,
  platformOrganizationListQuerySchema,
  platformPackageCreateRequestSchema,
  platformPackageUpdateRequestSchema,
  platformReasonRequestSchema,
} from "./platform-schemas.js";

const FULL_LIMITS = Object.fromEntries(LIMIT_KEY_VALUES.map((key) => [key, 5]));

describe("platform request schemas", () => {
  it("requires a non-empty reason to suspend", () => {
    expect(platformReasonRequestSchema.safeParse({ reason: " " }).success).toBe(false);
    expect(platformReasonRequestSchema.safeParse({ reason: "unpaid" }).success).toBe(true);
  });

  it("applies the paging defaults and caps the limit at 100", () => {
    expect(platformOrganizationListQuerySchema.parse({}).limit).toBe(20);
    expect(platformOrganizationListQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
  });

  it("accepts a package with every limit and refuses one that misses a limit", () => {
    const body = {
      packageKey: "STORE_PLUS",
      name: "Store Plus",
      isAddOn: false,
      moduleKeys: ["sales"],
      limits: FULL_LIMITS,
    };
    expect(platformPackageCreateRequestSchema.safeParse(body).success).toBe(true);
    const missing = { ...body, limits: { locations: 1 } };
    expect(platformPackageCreateRequestSchema.safeParse(missing).success).toBe(false);
  });

  it("refuses a package key that is not upper snake case and an unknown module key", () => {
    const body = {
      packageKey: "store",
      name: "Store",
      isAddOn: false,
      moduleKeys: [],
      limits: FULL_LIMITS,
    };
    expect(platformPackageCreateRequestSchema.safeParse(body).success).toBe(false);
    const unknown = { ...body, packageKey: "STORE", moduleKeys: ["no-such-module"] };
    expect(platformPackageCreateRequestSchema.safeParse(unknown).success).toBe(false);
  });

  it("refuses a package edit that changes nothing but carries a version", () => {
    expect(platformPackageUpdateRequestSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(
      platformPackageUpdateRequestSchema.safeParse({ version: 1, moduleKeys: [] }).success,
    ).toBe(true);
  });

  it("refuses TENANT_DISABLE as an operator override effect", () => {
    const body = { moduleKey: "workflow", effect: "TENANT_DISABLE", reason: "x" };
    expect(platformModuleOverrideCreateRequestSchema.safeParse(body).success).toBe(false);
    const grant = { ...body, effect: "PLATFORM_GRANT", expiresAt: "2030-01-01" };
    expect(platformModuleOverrideCreateRequestSchema.parse(grant).expiresAt).toBeInstanceOf(Date);
  });

  it("limits a trial extension to 1 through 30 days", () => {
    const parse = (days: number) =>
      platformExtendTrialRequestSchema.safeParse({ days, reason: "ok" }).success;
    expect([parse(0), parse(1), parse(30), parse(31)]).toEqual([false, true, true, false]);
  });

  it("refuses duplicate add-on package IDs", () => {
    const addOn = newId();
    const body = { basePackageId: newId(), addOnPackageIds: [addOn, addOn] };
    expect(platformChangePackageRequestSchema.safeParse(body).success).toBe(false);
  });
});

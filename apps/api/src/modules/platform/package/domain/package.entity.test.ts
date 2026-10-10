import { LIMIT_KEY, MODULE_KEY, PACKAGE_STATUS, type LimitMap } from "@banijjik/contracts";
import { isUuidV7 } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { Package, type NewPackageInput } from "./package.entity.js";

const NOW = new Date("2026-10-11T08:00:00.000Z");
const LIMITS: LimitMap = {
  [LIMIT_KEY.LOCATIONS]: 1,
  [LIMIT_KEY.MEMBERS]: 3,
  [LIMIT_KEY.OFFERINGS]: 500,
  [LIMIT_KEY.ORDERS_PER_MONTH]: null,
  [LIMIT_KEY.AI_MESSAGES_PER_MONTH]: 0,
  [LIMIT_KEY.SMS_PER_MONTH]: 100,
  [LIMIT_KEY.CHANNELS]: 0,
  [LIMIT_KEY.POS_DEVICES]: 0,
};

function input(overrides: Partial<NewPackageInput> = {}): NewPackageInput {
  return {
    packageKey: "STORE",
    nameKey: "package.STORE.name",
    isAddOn: false,
    moduleKeys: [MODULE_KEY.CONTACT, MODULE_KEY.WEBSITE],
    limits: LIMITS,
    limitIncrements: {},
    now: NOW,
    ...overrides,
  };
}

describe("Package.create", () => {
  it("creates an ACTIVE version 1 package with a UUID v7 id", () => {
    const created = Package.create(input());

    expect(isUuidV7(created.packageId)).toBe(true);
    expect(created).toMatchObject({
      packageKey: "STORE",
      status: PACKAGE_STATUS.ACTIVE,
      version: 1,
      createdAt: NOW,
    });
  });

  it("accepts a module that is in the catalogue but has no manifest yet", () => {
    expect(() => Package.create(input({ moduleKeys: [MODULE_KEY.KITCHEN_DISPLAY] }))).not.toThrow();
  });

  it.each([
    ["a module key outside the catalogue", { moduleKeys: ["teleporter"] }],
    ["a module key listed twice", { moduleKeys: [MODULE_KEY.POS, MODULE_KEY.POS] }],
    ["a lower-case package key", { packageKey: "store" }],
    ["a negative limit", { limits: { ...LIMITS, [LIMIT_KEY.MEMBERS]: -1 } }],
    ["a fractional limit", { limits: { ...LIMITS, [LIMIT_KEY.MEMBERS]: 1.5 } }],
    ["a base package with limit increments", { limitIncrements: { [LIMIT_KEY.MEMBERS]: 5 } }],
    [
      "a negative limit increment on an add-on",
      { isAddOn: true, limitIncrements: { [LIMIT_KEY.MEMBERS]: -5 } },
    ],
  ])("refuses %s", (_label, change) => {
    expect(() => Package.create(input(change))).toThrow(/VALIDATION_ERROR/);
  });

  it("lets an add-on carry limit increments", () => {
    const pack = Package.create(
      input({ isAddOn: true, moduleKeys: [], limitIncrements: { [LIMIT_KEY.MEMBERS]: 5 } }),
    );

    expect(pack.limitIncrements).toEqual({ members: 5 });
  });
});

import {
  LIMIT_KEY,
  MODULE_CLASS,
  MODULE_KEY,
  OFFERING_KIND,
  PERMISSION_KEY,
  SURFACE,
  type LimitMap,
  type MenuEntry,
} from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { aManifest } from "../../../../test-support/manifest-fixtures.js";
import { botToolsOf, menuOf, storefrontSectionsOf } from "./config-sections.js";
import { combineLimits, type LimitSource } from "./limits.js";
import { earliestExpiry, isOverrideActive } from "./module-override.js";

const BASE_LIMITS: LimitMap = {
  [LIMIT_KEY.LOCATIONS]: 2,
  [LIMIT_KEY.MEMBERS]: 10,
  [LIMIT_KEY.OFFERINGS]: 5000,
  [LIMIT_KEY.ORDERS_PER_MONTH]: null,
  [LIMIT_KEY.AI_MESSAGES_PER_MONTH]: 3000,
  [LIMIT_KEY.SMS_PER_MONTH]: 300,
  [LIMIT_KEY.CHANNELS]: 3,
  [LIMIT_KEY.POS_DEVICES]: 2,
};

function pack(increments: LimitSource["limitIncrements"]): LimitSource {
  return { limits: BASE_LIMITS, limitIncrements: increments };
}

describe("combineLimits (step 6)", () => {
  it("adds the increments of every add-on to the base limit", () => {
    const limits = combineLimits(pack({}), [
      pack({ [LIMIT_KEY.MEMBERS]: 5 }),
      pack({ [LIMIT_KEY.MEMBERS]: 5, [LIMIT_KEY.LOCATIONS]: 1 }),
    ]);

    expect(limits[LIMIT_KEY.MEMBERS]).toBe(20);
    expect(limits[LIMIT_KEY.LOCATIONS]).toBe(3);
    expect(limits[LIMIT_KEY.SMS_PER_MONTH]).toBe(300);
  });

  it("lets null (unlimited) win over any increment", () => {
    const limits = combineLimits(pack({}), [pack({ [LIMIT_KEY.ORDERS_PER_MONTH]: 500 })]);

    expect(limits[LIMIT_KEY.ORDERS_PER_MONTH]).toBeNull();
  });

  it("is zero for every limit when nothing was bought", () => {
    const limits = combineLimits(undefined, [pack({ [LIMIT_KEY.MEMBERS]: 5 })]);

    expect(Object.values(limits).every((value) => value === 0)).toBe(true);
  });
});

describe("module overrides", () => {
  const now = new Date("2026-10-11T08:00:00.000Z");
  const record = (expiresAt: Date | null) => ({
    moduleKey: MODULE_KEY.POS,
    effect: "PLATFORM_GRANT" as const,
    expiresAt,
  });

  it("counts an override without expiry, and one until its expiry instant", () => {
    expect(isOverrideActive(record(null), now)).toBe(true);
    expect(isOverrideActive(record(new Date(now.getTime() + 1)), now)).toBe(true);
    expect(isOverrideActive(record(now), now)).toBe(false);
    expect(isOverrideActive(record(new Date(now.getTime() - 1)), now)).toBe(false);
  });

  it("finds the earliest expiry among the overrides", () => {
    const later = new Date(now.getTime() + 10_000);
    const sooner = new Date(now.getTime() + 5_000);

    expect(earliestExpiry([record(null), record(later), record(sooner)])).toEqual(sooner);
    expect(earliestExpiry([record(null)])).toBeNull();
  });
});

describe("config sections (step 8)", () => {
  const entry = (menuKey: string, order: number, requiresKind?: MenuEntry["requiresKind"]) => ({
    menuKey,
    surface: SURFACE.ADMIN,
    groupKey: "sales",
    labelTermKey: `menu.${menuKey}`,
    path: `/${menuKey}`,
    iconKey: "i",
    permissionKey: PERMISSION_KEY.IAM_ROLE_READ,
    order,
    ...(requiresKind === undefined ? {} : { requiresKind }),
  });
  const manifests = [
    aManifest("sales", {
      moduleClass: MODULE_CLASS.CORE,
      menu: [entry("sales.orders", 2), entry("sales.deliveries", 1, OFFERING_KIND.PRODUCT)],
      botTools: ["create_request", "get_request_status"],
      storefrontSections: ["cart"],
    }),
    aManifest("website", { botTools: ["create_request"], storefrontSections: ["hero", "cart"] }),
  ];

  it("takes menu entries, bot tools and sections from the effective modules only", () => {
    const effective = new Set([MODULE_KEY.SALES]);

    expect(menuOf(manifests, effective, [OFFERING_KIND.PRODUCT]).map((e) => e.menuKey)).toEqual([
      "sales.deliveries",
      "sales.orders",
    ]);
    expect(botToolsOf(manifests, effective)).toEqual(["create_request", "get_request_status"]);
    expect(storefrontSectionsOf(manifests, effective)).toEqual(["cart"]);
  });

  it("hides a menu entry whose required kind is not effective", () => {
    const effective = new Set([MODULE_KEY.SALES]);

    expect(menuOf(manifests, effective, [OFFERING_KIND.SERVICE]).map((e) => e.menuKey)).toEqual([
      "sales.orders",
    ]);
  });

  it("lists a tool or section once when two modules contribute it", () => {
    const effective = new Set([MODULE_KEY.SALES, MODULE_KEY.WEBSITE]);

    expect(botToolsOf(manifests, effective)).toEqual(["create_request", "get_request_status"]);
    expect(storefrontSectionsOf(manifests, effective)).toEqual(["cart", "hero"]);
  });
});

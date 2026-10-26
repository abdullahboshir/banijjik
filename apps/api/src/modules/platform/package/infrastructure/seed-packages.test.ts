import { isModuleKey, LIMIT_KEY_VALUES, PACKAGE_KEY } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { Package } from "../domain/package.entity.js";
import { CORE_MODULE_KEYS, SEED_PACKAGES } from "./seed-packages.js";

const BASE_KEYS = [PACKAGE_KEY.STORE, PACKAGE_KEY.CHAT, PACKAGE_KEY.SHOP, PACKAGE_KEY.BUNDLE];

function seedOf(packageKey: string) {
  const found = SEED_PACKAGES.find((entry) => entry.packageKey === packageKey);
  if (found === undefined) throw new Error(`seed package ${packageKey} missing`);
  return found;
}

describe("seed packages (10-MODULE-CATALOG section 9)", () => {
  it("lists the four base packages and every add-on and pack once", () => {
    expect(SEED_PACKAGES.map((entry) => entry.packageKey).sort()).toEqual(
      Object.values(PACKAGE_KEY).sort(),
    );
    expect(
      SEED_PACKAGES.filter((entry) => !entry.isAddOn).map((entry) => entry.packageKey),
    ).toEqual(BASE_KEYS);
  });

  it("builds a valid Package from every entry, with module keys from the catalogue", () => {
    for (const entry of SEED_PACKAGES) {
      expect(entry.moduleKeys.every(isModuleKey), entry.packageKey).toBe(true);
      expect(() =>
        Package.create({ ...entry, nameKey: `package.${entry.packageKey}.name`, now: new Date() }),
      ).not.toThrow();
    }
  });

  it("gives every base package all CORE modules and a limit for every limit key", () => {
    for (const packageKey of BASE_KEYS) {
      const entry = seedOf(packageKey);
      expect(entry.moduleKeys, packageKey).toEqual(expect.arrayContaining([...CORE_MODULE_KEYS]));
      expect(Object.keys(entry.limits).sort(), packageKey).toEqual([...LIMIT_KEY_VALUES].sort());
    }
  });

  it("keeps the numbers of section 9 for BUNDLE and SHOP", () => {
    expect(seedOf(PACKAGE_KEY.BUNDLE).limits).toEqual({
      locations: 2,
      members: 10,
      offerings: 5000,
      ordersPerMonth: 10000,
      aiMessagesPerMonth: 3000,
      smsPerMonth: 300,
      channels: 3,
      posDevices: 2,
    });
    expect(seedOf(PACKAGE_KEY.SHOP).limits.posDevices).toBe(1);
    expect(seedOf(PACKAGE_KEY.SHOP).moduleKeys).toContain("pos");
  });

  it("makes the limit packs add exactly the amount of their name", () => {
    expect(seedOf(PACKAGE_KEY.PACK_LOCATION).limitIncrements).toEqual({ locations: 1 });
    expect(seedOf(PACKAGE_KEY.PACK_MEMBERS_5).limitIncrements).toEqual({ members: 5 });
    expect(seedOf(PACKAGE_KEY.PACK_AI_1000).limitIncrements).toEqual({ aiMessagesPerMonth: 1000 });
    expect(seedOf(PACKAGE_KEY.PACK_SMS_500).limitIncrements).toEqual({ smsPerMonth: 500 });
    expect(seedOf(PACKAGE_KEY.PACK_POS_DEVICE).limitIncrements).toEqual({ posDevices: 1 });
  });

  it("ADDON_POS adds the POS module and one device", () => {
    expect(seedOf(PACKAGE_KEY.ADDON_POS).moduleKeys).toEqual(["pos"]);
    expect(seedOf(PACKAGE_KEY.ADDON_POS).limitIncrements).toEqual({ posDevices: 1 });
  });
});

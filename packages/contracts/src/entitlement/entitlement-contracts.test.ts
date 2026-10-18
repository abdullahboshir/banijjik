import { describe, expect, it } from "vitest";
import { MODULE_KEY, MODULE_KEY_VALUES, isModuleKey } from "../modules/module-key.js";
import { ENTITLEMENT_MESSAGE_KEYS } from "./entitlement-message-keys.js";
import { LIMIT_KEY_VALUES } from "./limit-key.js";
import { PACKAGE_KEY } from "./package-key.js";
import { PAST_DUE_GRACE_DAYS, TRIAL_DAYS, TRIAL_PACKAGE_KEY } from "./trial-rules.js";

describe("module keys", () => {
  it("lists every module of 10-MODULE-CATALOG section 5, once each, in kebab-case", () => {
    expect(MODULE_KEY_VALUES).toHaveLength(40);
    expect(new Set(MODULE_KEY_VALUES).size).toBe(MODULE_KEY_VALUES.length);
    for (const key of MODULE_KEY_VALUES) expect(key).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it("tells a catalogue key from any other string", () => {
    expect(isModuleKey(MODULE_KEY.SAAS_BILLING)).toBe(true);
    expect(isModuleKey("saasBilling")).toBe(false);
  });
});

describe("entitlement constants", () => {
  it("lists the eight counted limits of section 9", () => {
    expect([...LIMIT_KEY_VALUES].sort()).toEqual(
      [
        "aiMessagesPerMonth",
        "channels",
        "locations",
        "members",
        "offerings",
        "ordersPerMonth",
        "posDevices",
        "smsPerMonth",
      ].sort(),
    );
  });

  it("starts a 14-day trial on BUNDLE and gives a 7-day grace", () => {
    expect(TRIAL_DAYS).toBe(14);
    expect(PAST_DUE_GRACE_DAYS).toBe(7);
    expect(TRIAL_PACKAGE_KEY).toBe(PACKAGE_KEY.BUNDLE);
  });

  it("has a name key for every seed package", () => {
    for (const packageKey of Object.values(PACKAGE_KEY)) {
      expect(ENTITLEMENT_MESSAGE_KEYS).toContain(`package.${packageKey}.name`);
    }
  });
});

import { describe, expect, it } from "vitest";
import { PLATFORM_ROLE } from "../iam/platform-role.js";
import {
  PLATFORM_PERMISSION_KEY,
  PLATFORM_ROLE_PERMISSIONS,
  platformPermissionsOf,
} from "./platform-permission.js";

const PERMISSION_PATTERN = /^platform\.[a-z]+\.[a-z]+$/;

describe("platform permissions", () => {
  it("names every key platform.<module>.<action>", () => {
    for (const key of Object.values(PLATFORM_PERMISSION_KEY)) {
      expect(key).toMatch(PERMISSION_PATTERN);
    }
  });

  it("gives SUPER_ADMIN every permission", () => {
    const granted = platformPermissionsOf([PLATFORM_ROLE.SUPER_ADMIN]);
    expect([...granted].sort()).toEqual(Object.values(PLATFORM_PERMISSION_KEY).sort());
  });

  it("lets SUPPORT suspend but not edit packages or entitlements", () => {
    const granted = platformPermissionsOf([PLATFORM_ROLE.SUPPORT]);
    expect(granted.has(PLATFORM_PERMISSION_KEY.TENANT_SUSPEND)).toBe(true);
    expect(granted.has(PLATFORM_PERMISSION_KEY.PACKAGE_WRITE)).toBe(false);
    expect(granted.has(PLATFORM_PERMISSION_KEY.ENTITLEMENT_WRITE)).toBe(false);
    expect(granted.has(PLATFORM_PERMISSION_KEY.OPERATOR_READ)).toBe(false);
    expect(granted.has(PLATFORM_PERMISSION_KEY.OPERATOR_WRITE)).toBe(false);
    expect(granted.has(PLATFORM_PERMISSION_KEY.INDUSTRY_READ)).toBe(true);
    expect(granted.has(PLATFORM_PERMISSION_KEY.INDUSTRY_WRITE)).toBe(false);
  });

  it("lets BILLING edit entitlements and subscriptions but not suspend or edit packages", () => {
    const granted = platformPermissionsOf([PLATFORM_ROLE.BILLING]);
    expect(granted.has(PLATFORM_PERMISSION_KEY.TENANT_SUSPEND)).toBe(false);
    expect(granted.has(PLATFORM_PERMISSION_KEY.PACKAGE_WRITE)).toBe(false);
    expect(granted.has(PLATFORM_PERMISSION_KEY.OPERATOR_READ)).toBe(false);
    expect(granted.has(PLATFORM_PERMISSION_KEY.OPERATOR_WRITE)).toBe(false);
    expect(granted.has(PLATFORM_PERMISSION_KEY.ENTITLEMENT_WRITE)).toBe(true);
    expect(granted.has(PLATFORM_PERMISSION_KEY.SUBSCRIPTION_WRITE)).toBe(true);
    expect(granted.has(PLATFORM_PERMISSION_KEY.INDUSTRY_READ)).toBe(true);
    expect(granted.has(PLATFORM_PERMISSION_KEY.INDUSTRY_WRITE)).toBe(false);
  });

  it("gives each role exactly the permissions of the final mapping (ADR-093)", () => {
    const sorted = (role: keyof typeof PLATFORM_ROLE_PERMISSIONS) =>
      [...PLATFORM_ROLE_PERMISSIONS[role]].sort();
    expect(sorted(PLATFORM_ROLE.SUPPORT)).toEqual(
      [
        PLATFORM_PERMISSION_KEY.TENANT_READ,
        PLATFORM_PERMISSION_KEY.TENANT_SUSPEND,
        PLATFORM_PERMISSION_KEY.PACKAGE_READ,
        PLATFORM_PERMISSION_KEY.ENTITLEMENT_READ,
        PLATFORM_PERMISSION_KEY.SUBSCRIPTION_READ,
        PLATFORM_PERMISSION_KEY.INDUSTRY_READ,
      ].sort(),
    );
    expect(sorted(PLATFORM_ROLE.BILLING)).toEqual(
      [
        PLATFORM_PERMISSION_KEY.TENANT_READ,
        PLATFORM_PERMISSION_KEY.PACKAGE_READ,
        PLATFORM_PERMISSION_KEY.ENTITLEMENT_READ,
        PLATFORM_PERMISSION_KEY.ENTITLEMENT_WRITE,
        PLATFORM_PERMISSION_KEY.SUBSCRIPTION_READ,
        PLATFORM_PERMISSION_KEY.SUBSCRIPTION_WRITE,
        PLATFORM_PERMISSION_KEY.INDUSTRY_READ,
      ].sort(),
    );
  });

  it("reserves package writes for SUPER_ADMIN", () => {
    const holders = Object.values(PLATFORM_ROLE).filter((role) =>
      PLATFORM_ROLE_PERMISSIONS[role].includes(PLATFORM_PERMISSION_KEY.PACKAGE_WRITE),
    );
    expect(holders).toEqual([PLATFORM_ROLE.SUPER_ADMIN]);
  });

  it("reserves the audit log for SUPER_ADMIN", () => {
    for (const role of [PLATFORM_ROLE.SUPPORT, PLATFORM_ROLE.BILLING]) {
      expect(PLATFORM_ROLE_PERMISSIONS[role]).not.toContain(PLATFORM_PERMISSION_KEY.AUDIT_READ);
    }
  });

  it("grants nothing to an operator without roles", () => {
    expect(platformPermissionsOf([]).size).toBe(0);
  });

  it("unions the permissions of several roles", () => {
    const granted = platformPermissionsOf([PLATFORM_ROLE.SUPPORT, PLATFORM_ROLE.BILLING]);
    expect(granted.has(PLATFORM_PERMISSION_KEY.TENANT_SUSPEND)).toBe(true);
    expect(granted.has(PLATFORM_PERMISSION_KEY.ENTITLEMENT_WRITE)).toBe(true);
  });
});

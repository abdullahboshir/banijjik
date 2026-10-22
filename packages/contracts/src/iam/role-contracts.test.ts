import { describe, expect, it } from "vitest";
import { permissionDefinition } from "./permission-definition.js";
import {
  isPermissionKey,
  ORGANIZATION_WIDE_PERMISSION_KEYS,
  PERMISSION_KEY,
  PERMISSION_KEY_PATTERN,
  PERMISSION_LABEL_MESSAGE_KEYS,
  permissionAction,
  permissionModuleKey,
} from "./permission-key.js";
import { ROLE_MESSAGE_KEYS } from "./role-message-keys.js";
import { ROLE_STATUS } from "./role-status.js";
import { SURFACE } from "./surface.js";

describe("ORGANIZATION_WIDE_PERMISSION_KEYS", () => {
  it("names the organization-wide writes, including custom field definitions", () => {
    expect([...ORGANIZATION_WIDE_PERMISSION_KEYS].sort()).toEqual(
      [
        PERMISSION_KEY.ORGANIZATION_PROFILE_UPDATE,
        PERMISSION_KEY.AUDIT_LOG_READ,
        PERMISSION_KEY.ORGANIZATION_LOCATION_CREATE,
        PERMISSION_KEY.ORGANIZATION_LOCATION_UPDATE,
        PERMISSION_KEY.ORGANIZATION_LOCATION_ARCHIVE,
        PERMISSION_KEY.IAM_ROLE_CREATE,
        PERMISSION_KEY.IAM_ROLE_UPDATE,
        PERMISSION_KEY.IAM_ROLE_ARCHIVE,
        PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_CREATE,
        PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_UPDATE,
        PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_ARCHIVE,
        PERMISSION_KEY.SETTINGS_TERM_UPDATE,
        PERMISSION_KEY.SETTINGS_MODULE_UPDATE,
        PERMISSION_KEY.ACCOUNTING_LEDGER_READ,
      ].sort(),
    );
  });
});

describe("PERMISSION_KEY", () => {
  it("lists the keys of every built module", () => {
    expect(Object.values(PERMISSION_KEY)).toHaveLength(89);
    expect(Object.values(PERMISSION_KEY)).toEqual(
      expect.arrayContaining([
        "bookkeeping.account.read",
        "bookkeeping.account.create",
        "bookkeeping.account.update",
        "bookkeeping.journal.read",
        "bookkeeping.journal.createManual",
        "bookkeeping.statement.read",
        "credit.purchase.read",
        "credit.purchase.verify",
      ]),
    );
  });

  it("only holds keys that match the module.entity.action pattern", () => {
    for (const permissionKey of Object.values(PERMISSION_KEY)) {
      expect(permissionKey).toMatch(PERMISSION_KEY_PATTERN);
    }
  });

  it("has no duplicate keys", () => {
    const keys = Object.values(PERMISSION_KEY);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("rejects keys that break the pattern", () => {
    for (const bad of ["iam", "iam.role", "IAM.role.read", "iam.Role.read", "iam.role.read.x"]) {
      expect(PERMISSION_KEY_PATTERN.test(bad), bad).toBe(false);
    }
  });

  it("recognises catalogue keys and nothing else", () => {
    expect(isPermissionKey("iam.role.read")).toBe(true);
    expect(isPermissionKey("platform.tenant.read")).toBe(false);
  });

  it("reads the module and the action out of a key", () => {
    expect(permissionModuleKey("organization.member.readSensitive")).toBe("organization");
    expect(permissionAction("organization.member.readSensitive")).toBe("readSensitive");
  });

  it("has one label message key per permission", () => {
    expect(PERMISSION_LABEL_MESSAGE_KEYS).toContain("permission.iam.role.read");
    expect(PERMISSION_LABEL_MESSAGE_KEYS).toContain("permission.directory.listing.read");
    expect(PERMISSION_LABEL_MESSAGE_KEYS).toContain("permission.credit.account.adjust");
    expect(PERMISSION_LABEL_MESSAGE_KEYS).toContain("permission.credit.purchase.read");
    expect(PERMISSION_LABEL_MESSAGE_KEYS).toContain("permission.credit.purchase.verify");
    expect(PERMISSION_LABEL_MESSAGE_KEYS).toHaveLength(89);
  });
});

describe("permissionDefinition", () => {
  it("defaults to a non-sensitive admin permission with a derived label key", () => {
    expect(permissionDefinition(PERMISSION_KEY.IAM_ROLE_READ)).toEqual({
      permissionKey: "iam.role.read",
      labelKey: "permission.iam.role.read",
      isSensitive: false,
      surface: SURFACE.ADMIN,
    });
  });

  it("can mark a permission sensitive", () => {
    const definition = permissionDefinition(PERMISSION_KEY.ORGANIZATION_OWNERSHIP_TRANSFER, {
      isSensitive: true,
    });
    expect(definition.isSensitive).toBe(true);
  });
});

describe("role enums and message keys", () => {
  it("lists the role statuses", () => {
    expect(Object.keys(ROLE_STATUS)).toEqual(["ACTIVE", "ARCHIVED"]);
  });

  it("lists the five surfaces of 10 section 2", () => {
    expect(Object.keys(SURFACE)).toEqual(["ADMIN", "POS", "RIDER", "PLATFORM", "STOREFRONT"]);
  });

  it("has no duplicate role message keys", () => {
    expect(new Set(ROLE_MESSAGE_KEYS).size).toBe(ROLE_MESSAGE_KEYS.length);
  });
});

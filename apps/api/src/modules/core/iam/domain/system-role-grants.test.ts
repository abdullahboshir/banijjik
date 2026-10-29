import { PERMISSION_KEY, SYSTEM_ROLE_KEY, type PermissionKey } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { grantedKeysOf, isSystemRoleKey } from "./system-role-grants.js";

const ALL_KEYS = Object.values(PERMISSION_KEY);
const IAM_KEYS = ALL_KEYS.filter((key) => key.startsWith("iam."));
const ORGANIZATION_KEYS = ALL_KEYS.filter((key) => key.startsWith("organization."));

function sorted(keys: Iterable<string>): string[] {
  return [...keys].sort();
}

// The table of 10-MODULE-CATALOG section 10, for the modules that exist.
const ORGANIZATION_EXPECTED = {
  [SYSTEM_ROLE_KEY.OWNER]: ORGANIZATION_KEYS,
  [SYSTEM_ROLE_KEY.MANAGER]: ORGANIZATION_KEYS.filter(
    (key) =>
      key !== PERMISSION_KEY.ORGANIZATION_OWNERSHIP_TRANSFER &&
      key !== PERMISSION_KEY.ORGANIZATION_MEMBER_READ_SENSITIVE,
  ),
  [SYSTEM_ROLE_KEY.CASHIER]: [],
  [SYSTEM_ROLE_KEY.STAFF]: [],
  [SYSTEM_ROLE_KEY.RIDER]: [],
  [SYSTEM_ROLE_KEY.VIEWER]: [PERMISSION_KEY.ORGANIZATION_LOCATION_READ],
};

const IAM_EXPECTED = {
  [SYSTEM_ROLE_KEY.OWNER]: IAM_KEYS,
  [SYSTEM_ROLE_KEY.MANAGER]: [PERMISSION_KEY.IAM_ROLE_READ, PERMISSION_KEY.IAM_APPROVAL_GRANT],
  [SYSTEM_ROLE_KEY.CASHIER]: [],
  [SYSTEM_ROLE_KEY.STAFF]: [],
  [SYSTEM_ROLE_KEY.RIDER]: [],
  [SYSTEM_ROLE_KEY.VIEWER]: [],
};

describe("system role grants (10 section 10)", () => {
  it("lets managers read SMS gateway settings and logs but not change credentials", () => {
    const manager = grantedKeysOf(SYSTEM_ROLE_KEY.MANAGER, ALL_KEYS);
    expect(manager.has(PERMISSION_KEY.SMS_GATEWAY_READ)).toBe(true);
    expect(manager.has(PERMISSION_KEY.SMS_LOG_READ)).toBe(true);
    expect(manager.has(PERMISSION_KEY.SMS_CREDENTIAL_UPDATE)).toBe(false);
  });

  it.each(Object.values(SYSTEM_ROLE_KEY))(
    "gives %s exactly the organization and iam keys of the template",
    (roleKey) => {
      const granted = grantedKeysOf(roleKey, ALL_KEYS);

      const organizationPart = [...granted].filter((key) => key.startsWith("organization."));
      const iamPart = [...granted].filter((key) => key.startsWith("iam."));
      expect(sorted(organizationPart)).toEqual(sorted(ORGANIZATION_EXPECTED[roleKey]));
      expect(sorted(iamPart)).toEqual(sorted(IAM_EXPECTED[roleKey]));
    },
  );

  it("gives OWNER a key of a module added later without any template row", () => {
    // Safe: `crm` is no module of this application, so no grants row names it. A key of it proves
    // OWNER is computed from the catalogue instead of listed.
    const futureKey = "crm.note.read" as PermissionKey;

    const owner = grantedKeysOf(SYSTEM_ROLE_KEY.OWNER, [...ALL_KEYS, futureKey]);
    const manager = grantedKeysOf(SYSTEM_ROLE_KEY.MANAGER, [...ALL_KEYS, futureKey]);

    expect(owner.has(futureKey)).toBe(true);
    expect(manager.has(futureKey)).toBe(false);
  });

  it.each([
    [
      SYSTEM_ROLE_KEY.OWNER,
      [
        "settings.setting.read",
        "settings.setting.update",
        "settings.term.update",
        "settings.module.update",
      ],
    ],
    [
      SYSTEM_ROLE_KEY.MANAGER,
      [
        "settings.setting.read",
        "settings.setting.update",
        "settings.term.update",
        "settings.module.update",
      ],
    ],
    [SYSTEM_ROLE_KEY.CASHIER, ["settings.setting.read"]],
    [SYSTEM_ROLE_KEY.STAFF, ["settings.setting.read"]],
    [SYSTEM_ROLE_KEY.RIDER, []],
    [SYSTEM_ROLE_KEY.VIEWER, ["settings.setting.read"]],
  ] as const)("gives %s the settings keys of ADR-103", (roleKey, expected) => {
    const granted = [...grantedKeysOf(roleKey, ALL_KEYS)].filter((key) =>
      key.startsWith("settings."),
    );
    expect(sorted(granted)).toEqual(sorted(expected));
  });

  it("recognises system role keys and rejects custom ones", () => {
    expect(isSystemRoleKey("CASHIER")).toBe(true);
    expect(isSystemRoleKey("custom.0199a3b2-7c11-7a3e-9d5e-1f2e3d4c5b6a")).toBe(false);
  });
});

describe("system role grants of the file module (card 3.0)", () => {
  const FILE_KEYS = ALL_KEYS.filter((key) => key.startsWith("file."));
  const CREATE_AND_READ = [PERMISSION_KEY.FILE_ASSET_CREATE, PERMISSION_KEY.FILE_ASSET_READ];
  const FILE_EXPECTED = {
    [SYSTEM_ROLE_KEY.OWNER]: FILE_KEYS,
    [SYSTEM_ROLE_KEY.MANAGER]: FILE_KEYS,
    [SYSTEM_ROLE_KEY.CASHIER]: CREATE_AND_READ,
    [SYSTEM_ROLE_KEY.STAFF]: CREATE_AND_READ,
    [SYSTEM_ROLE_KEY.RIDER]: [],
    [SYSTEM_ROLE_KEY.VIEWER]: [PERMISSION_KEY.FILE_ASSET_READ],
  };

  it.each(Object.values(SYSTEM_ROLE_KEY))("gives %s the file keys of the plan", (roleKey) => {
    const granted = [...grantedKeysOf(roleKey, ALL_KEYS)].filter((key) => key.startsWith("file."));

    expect(sorted(granted)).toEqual(sorted(FILE_EXPECTED[roleKey]));
  });
});

describe("system role grants of the website module (card 4.1 A3I)", () => {
  it("gives owner and manager site publish; staff only the legacy page read", () => {
    const owner = grantedKeysOf(SYSTEM_ROLE_KEY.OWNER, ALL_KEYS);
    const manager = grantedKeysOf(SYSTEM_ROLE_KEY.MANAGER, ALL_KEYS);
    const staff = grantedKeysOf(SYSTEM_ROLE_KEY.STAFF, ALL_KEYS);
    expect(owner.has(PERMISSION_KEY.WEBSITE_SITE_PUBLISH)).toBe(true);
    expect(manager.has(PERMISSION_KEY.WEBSITE_SITE_PUBLISH)).toBe(true);
    expect(staff.has(PERMISSION_KEY.WEBSITE_SITE_PUBLISH)).toBe(false);
    expect(staff.has(PERMISSION_KEY.WEBSITE_SITE_READ)).toBe(false);
    expect(staff.has(PERMISSION_KEY.WEBSITE_PAGE_READ)).toBe(true);
  });
});

describe("system role grants of website domains (card 4.2 A2I)", () => {
  it("does not give staff website.domain.manage", () => {
    const owner = grantedKeysOf(SYSTEM_ROLE_KEY.OWNER, ALL_KEYS);
    const manager = grantedKeysOf(SYSTEM_ROLE_KEY.MANAGER, ALL_KEYS);
    const staff = grantedKeysOf(SYSTEM_ROLE_KEY.STAFF, ALL_KEYS);
    expect(owner.has(PERMISSION_KEY.WEBSITE_DOMAIN_MANAGE)).toBe(true);
    expect(manager.has(PERMISSION_KEY.WEBSITE_DOMAIN_MANAGE)).toBe(true);
    expect(staff.has(PERMISSION_KEY.WEBSITE_DOMAIN_MANAGE)).toBe(false);
  });
});

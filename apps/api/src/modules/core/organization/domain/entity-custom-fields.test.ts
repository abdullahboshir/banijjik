import { ALL_LOCATIONS, SEED_INDUSTRY_TEMPLATE_KEY } from "@banijjik/contracts";
import { newId, type OrganizationId, type RoleId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { Member } from "./member.entity.js";
import { Organization } from "./organization.entity.js";

const NOW = new Date("2026-10-17T08:00:00.000Z");
const STORED = {
  values: { branch_code: "DHK-01" },
  search: [{ fieldKey: "branch_code", value: "dhk-01" }],
};

function anOrganization(): Organization {
  return Organization.create({
    name: "Rahim Store",
    slug: "rahim-store",
    industryTemplateKey: SEED_INDUSTRY_TEMPLATE_KEY.RETAIL,
    ownerUserId: newId() as UserId,
    defaultLocale: "bn",
    now: NOW,
  });
}

function aMember(): Member {
  return Member.joinActive({
    organizationId: newId() as OrganizationId,
    userId: newId() as UserId,
    displayName: "Karim",
    assignments: [{ locationId: ALL_LOCATIONS, roleId: newId() as RoleId }],
    employeeNumber: undefined,
    createdByUserId: null,
    now: NOW,
  });
}

describe("custom fields on an organization", () => {
  it("starts with no values and no search entries", () => {
    const organization = anOrganization();

    expect(organization.customFields).toEqual({});
    expect(organization.customFieldSearch).toEqual([]);
  });

  it("keeps the stored values when a change names none, and takes the given ones otherwise", () => {
    const withValues = anOrganization().withProfileChanges({ customFields: STORED });

    const renamed = withValues.withProfileChanges({ name: "Rahim Traders" });
    const cleared = withValues.withProfileChanges({ customFields: { values: {}, search: [] } });

    expect(withValues.customFields).toEqual(STORED.values);
    expect(withValues.customFieldSearch).toEqual(STORED.search);
    expect(renamed.customFields).toEqual(STORED.values);
    expect(cleared.customFields).toEqual({});
  });
});

describe("custom fields on a member", () => {
  it("starts with no values and no search entries", () => {
    const member = aMember();

    expect(member.customFields).toEqual({});
    expect(member.customFieldSearch).toEqual([]);
  });

  it("keeps the stored values when a change names none, and takes the given ones otherwise", () => {
    const withValues = aMember().withChanges({ customFields: STORED });

    const renamed = withValues.withChanges({ displayName: "Karim Hossain" });

    expect(withValues.customFields).toEqual(STORED.values);
    expect(withValues.customFieldSearch).toEqual(STORED.search);
    expect(renamed.customFields).toEqual(STORED.values);
    expect(renamed.displayName).toBe("Karim Hossain");
  });

  it("refuses to change a removed member, custom fields included", () => {
    const removed = aMember().remove();

    expect(() => removed.withChanges({ customFields: STORED })).toThrow();
  });
});

import { ROLE_STATUS } from "@banijjik/contracts";
import { newId, type OrganizationId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { Role } from "./role.entity.js";

const NOW = new Date("2026-10-11T08:00:00.000Z");
const LATER = new Date("2026-10-11T09:00:00.000Z");

function aCustomRole(): Role {
  return Role.createCustom({
    organizationId: newId<OrganizationId>(),
    name: "  Shift lead ",
    permissionKeys: ["iam.role.read", "iam.role.read"],
    createdByUserId: newId<UserId>(),
    now: NOW,
  });
}

function aSystemRole(): Role {
  return Role.createSystem({
    organizationId: newId<OrganizationId>(),
    roleKey: "STAFF",
    createdByUserId: newId<UserId>(),
    now: NOW,
  });
}

describe("Role.createCustom", () => {
  it("generates the role key from the id, trims the name and drops repeated keys", () => {
    const role = aCustomRole();

    expect(role).toMatchObject({
      name: "Shift lead",
      nameKey: null,
      isSystem: false,
      status: ROLE_STATUS.ACTIVE,
      permissionKeys: ["iam.role.read"],
      version: 1,
    });
    expect(role.roleKey).toBe(`custom.${role.roleId}`);
  });

  it("refuses a name outside 2 to 60 characters", () => {
    const create = (name: string) => () =>
      Role.createCustom({
        organizationId: newId<OrganizationId>(),
        name,
        permissionKeys: [],
        createdByUserId: newId<UserId>(),
        now: NOW,
      });

    expect(create("A")).toThrow();
    expect(create("x".repeat(61))).toThrow();
  });
});

describe("Role.edit and Role.archive", () => {
  it("applies a rename without touching the permissions", () => {
    const updatedByUserId = newId<UserId>();

    const edited = aCustomRole().edit({ name: "Supervisor", updatedByUserId, now: LATER });

    expect(edited).toMatchObject({
      name: "Supervisor",
      permissionKeys: ["iam.role.read"],
      updatedByUserId,
      updatedAt: LATER,
    });
  });

  it("refuses to change or archive a system role", () => {
    const changes = { updatedByUserId: newId<UserId>(), now: LATER };

    expect(() => aSystemRole().edit({ name: "Renamed", ...changes })).toThrow(/BUSINESS_RULE/);
    expect(() => aSystemRole().archive(changes)).toThrow(/BUSINESS_RULE/);
  });

  it("refuses to change an archived role", () => {
    const changes = { updatedByUserId: newId<UserId>(), now: LATER };
    const archived = aCustomRole().archive(changes);

    expect(archived.status).toBe(ROLE_STATUS.ARCHIVED);
    expect(() => archived.edit({ name: "Again", ...changes })).toThrow(/INVALID_TRANSITION/);
  });
});

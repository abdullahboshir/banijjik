import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { newId, type OrganizationId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { Role } from "./role.entity.js";

const NOW = new Date("2026-10-11T08:00:00.000Z");

describe("Role.createSystem", () => {
  it("creates a system role with a name key, no permissions yet and version 1", () => {
    const organizationId = newId() as OrganizationId;
    const createdByUserId = newId() as UserId;

    const role = Role.createSystem({
      organizationId,
      roleKey: SYSTEM_ROLE_KEY.CASHIER,
      createdByUserId,
      now: NOW,
    });

    expect(role).toMatchObject({
      organizationId,
      roleKey: "CASHIER",
      nameKey: "role.cashier",
      isSystem: true,
      permissionKeys: [],
      version: 1,
      createdByUserId,
    });
    expect(role.roleId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

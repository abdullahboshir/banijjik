import { PLATFORM_ROLE, USER_STATUS } from "@banijjik/contracts";
import { asId, newId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { PlatformOperator } from "./platform-operator.entity.js";

const NOW = new Date("2026-10-13T08:00:00.000Z");
const LATER = new Date("2026-10-13T09:00:00.000Z");

function stored(
  roles: readonly (typeof PLATFORM_ROLE)[keyof typeof PLATFORM_ROLE][] = [PLATFORM_ROLE.SUPPORT],
) {
  return PlatformOperator.restore({
    platformOperatorId: newId(),
    userId: asId<UserId>(newId()),
    platformRoles: roles,
    status: USER_STATUS.ACTIVE,
    version: 3,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

describe("PlatformOperator", () => {
  it("grants an active operator at version 1", () => {
    const userId = asId<UserId>(newId());
    const granted = PlatformOperator.grant({
      userId,
      platformRoles: [PLATFORM_ROLE.BILLING],
      now: NOW,
    });
    expect(granted).toMatchObject({ userId, status: USER_STATUS.ACTIVE, version: 1 });
    expect(granted.isActiveSuperAdmin()).toBe(false);
  });

  it("treats role lists as a set and only an active super admin as the actor", () => {
    const operator = stored([PLATFORM_ROLE.SUPER_ADMIN, PLATFORM_ROLE.SUPPORT]);
    expect(operator.hasSameRoles([PLATFORM_ROLE.SUPPORT, PLATFORM_ROLE.SUPER_ADMIN])).toBe(true);
    expect(operator.hasSameRoles([PLATFORM_ROLE.SUPER_ADMIN])).toBe(false);
    expect(operator.isActiveSuperAdmin()).toBe(true);
    expect(operator.withStatus(USER_STATUS.DISABLED, LATER).isActiveSuperAdmin()).toBe(false);
  });

  it("copies roles and status without bumping the version", () => {
    const operator = stored();
    const changed = operator.withRoles([PLATFORM_ROLE.BILLING], LATER);
    expect(changed.platformRoles).toEqual([PLATFORM_ROLE.BILLING]);
    expect(changed.version).toBe(operator.version);
    expect(changed.updatedAt).toEqual(LATER);
    expect(operator.platformRoles).toEqual([PLATFORM_ROLE.SUPPORT]);
  });
});

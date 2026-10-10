import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { newId, type OrganizationId, type RoleId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { MutableClock } from "../../../../../test-support/mutable-clock.js";
import type { Role } from "../../domain/role.entity.js";
import type { RoleRepository } from "../ports/role-repository.js";
import { ProvisionSystemRolesUseCase } from "./provision-system-roles.use-case.js";

class InMemoryRoleRepository implements RoleRepository {
  readonly roles: Role[] = [];

  async insertMany(roles: readonly Role[]): Promise<void> {
    this.roles.push(...roles);
  }

  async findRoleKeysByIds(): Promise<ReadonlyMap<RoleId, string>> {
    return new Map();
  }
}

describe("ProvisionSystemRolesUseCase", () => {
  it("creates the six system roles of an organization and returns the owner role id", async () => {
    const repository = new InMemoryRoleRepository();
    const useCase = new ProvisionSystemRolesUseCase({
      roles: repository,
      clock: new MutableClock(),
    });
    const organizationId = newId() as OrganizationId;
    const actorUserId = newId() as UserId;

    const result = await useCase.execute({ organizationId, actorUserId });

    expect(repository.roles.map((role) => role.roleKey).sort()).toEqual(
      Object.values(SYSTEM_ROLE_KEY).sort(),
    );
    expect(repository.roles.every((role) => role.isSystem)).toBe(true);
    expect(repository.roles.every((role) => role.permissionKeys.length === 0)).toBe(true);
    expect(repository.roles.every((role) => role.organizationId === organizationId)).toBe(true);
    expect(repository.roles.find((role) => role.roleId === result.ownerRoleId)?.roleKey).toBe(
      "OWNER",
    );
  });
});

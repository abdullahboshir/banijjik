import {
  ALL_LOCATIONS,
  ORGANIZATION_STATUS,
  SEED_INDUSTRY_TEMPLATE_KEY,
} from "@banijjik/contracts";
import { newId, type RoleId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import {
  FakeRoleKeyLookup,
  InMemoryMemberRepository,
  InMemoryOrganizationRepository,
} from "../../../../../test-support/organization-fakes.js";
import { Member } from "../../domain/member.entity.js";
import { Organization } from "../../domain/organization.entity.js";
import { ListMyOrganizationsUseCase } from "./list-my-organizations.use-case.js";

const NOW = new Date("2026-10-11T08:00:00.000Z");

function aWorld() {
  const members = new InMemoryMemberRepository();
  const organizations = new InMemoryOrganizationRepository();
  const roleKeys = new FakeRoleKeyLookup();
  const useCase = new ListMyOrganizationsUseCase({ members, organizations, roleKeys });
  const userId = newId() as UserId;

  /** Adds an organization the user belongs to, with one role at ALL locations. */
  function join(name: string, slug: string, roleKey: string): Organization {
    const organization = Organization.create({
      name,
      slug,
      industryTemplateKey: SEED_INDUSTRY_TEMPLATE_KEY.RETAIL,
      ownerUserId: newId() as UserId,
      defaultLocale: "bn",
      now: NOW,
    });
    const roleId = newId() as RoleId;
    roleKeys.keysByRoleId.set(roleId, roleKey);
    organizations.organizations.set(organization.organizationId, organization);
    members.members.push(
      Member.joinActive({
        organizationId: organization.organizationId,
        userId,
        displayName: "Rahim",
        assignments: [{ locationId: ALL_LOCATIONS, roleId }],
        employeeNumber: undefined,
        createdByUserId: userId,
        now: NOW,
      }),
    );
    return organization;
  }

  return { useCase, userId, join, members, organizations, roleKeys };
}

describe("ListMyOrganizationsUseCase", () => {
  it("lists every organization of the user with the role keys, sorted by name", async () => {
    const world = aWorld();
    world.join("Zed Shop", "zed-shop", "OWNER");
    world.join("Alpha Shop", "alpha-shop", "MANAGER");

    const listed = await world.useCase.execute({ userId: world.userId });

    expect(listed.map((organization) => organization.name)).toEqual(["Alpha Shop", "Zed Shop"]);
    expect(listed.map((organization) => organization.roleKeys)).toEqual([["MANAGER"], ["OWNER"]]);
  });

  it("leaves out a CLOSED organization and shows a SUSPENDED one with its status", async () => {
    const world = aWorld();
    const closed = world.join("Closed Shop", "closed-shop", "OWNER");
    const suspended = world.join("Paused Shop", "paused-shop", "OWNER");
    world.organizations.organizations.set(
      closed.organizationId,
      Organization.restore({ ...closed, status: ORGANIZATION_STATUS.CLOSED }),
    );
    world.organizations.organizations.set(
      suspended.organizationId,
      Organization.restore({ ...suspended, status: ORGANIZATION_STATUS.SUSPENDED }),
    );

    const listed = await world.useCase.execute({ userId: world.userId });

    expect(listed.map((organization) => [organization.slug, organization.status])).toEqual([
      ["paused-shop", "SUSPENDED"],
    ]);
  });

  it("never lists the organizations of another user", async () => {
    const world = aWorld();
    world.join("My Shop", "my-shop", "OWNER");

    const listed = await world.useCase.execute({ userId: newId() as UserId });

    expect(listed).toEqual([]);
  });

  it("reads memberships, organizations and role keys once each, however many organizations", async () => {
    const world = aWorld();
    for (let index = 0; index < 7; index += 1) {
      world.join(`Shop ${index}`, `shop-${index}`, "OWNER");
    }

    await world.useCase.execute({ userId: world.userId });

    expect(world.members.findActiveByUserIdCalls).toBe(1);
    expect(world.organizations.findOpenByIdsCalls).toBe(1);
    expect(world.roleKeys.calls).toBe(1);
  });

  it("stops after the membership query when the user belongs to nothing", async () => {
    const world = aWorld();

    await world.useCase.execute({ userId: world.userId });

    expect(world.organizations.findOpenByIdsCalls).toBe(0);
    expect(world.roleKeys.calls).toBe(0);
  });
});

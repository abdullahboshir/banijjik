import { newId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import {
  FakeActorProfileReader,
  FakeSystemRoleProvisioner,
  InMemoryLocationRepository,
  InMemoryMemberNumberSequence,
  InMemoryMemberRepository,
  InMemoryOrganizationRepository,
  PassThroughContextRunner,
} from "../../../../../test-support/organization-fakes.js";
import { PassThroughUnitOfWork } from "../../../../../test-support/iam-fakes.js";
import { MutableClock } from "../../../../../test-support/mutable-clock.js";
import { DomainRuleError, SlugTakenError } from "../../domain/errors.js";
import {
  CreateOrganizationUseCase,
  type CreateOrganizationInput,
} from "./create-organization.use-case.js";

function aWorld() {
  const organizations = new InMemoryOrganizationRepository();
  const locations = new InMemoryLocationRepository();
  const members = new InMemoryMemberRepository();
  const systemRoles = new FakeSystemRoleProvisioner();
  const actorProfiles = new FakeActorProfileReader();
  const memberNumbers = new InMemoryMemberNumberSequence();
  const actorUserId = newId() as UserId;
  actorProfiles.profiles.set(actorUserId, { name: "Rahim Uddin", preferredLocale: "en" });
  const useCase = new CreateOrganizationUseCase({
    organizations,
    locations,
    members,
    systemRoles,
    actorProfiles,
    memberNumbers,
    unitOfWork: new PassThroughUnitOfWork(),
    contextRunner: new PassThroughContextRunner(),
    clock: new MutableClock(),
  });
  const input: CreateOrganizationInput = {
    actorUserId,
    name: "Rahim Store",
    slug: "rahim-store",
    industryTemplateKey: "RETAIL",
    district: "Dhaka",
  };
  return { useCase, input, organizations, locations, members, systemRoles, memberNumbers };
}

describe("CreateOrganizationUseCase", () => {
  it("creates one organization, one default location and one owner member", async () => {
    const world = aWorld();

    const created = await world.useCase.execute(world.input);

    expect(world.organizations.organizations.size).toBe(1);
    expect(world.locations.locations).toHaveLength(1);
    expect(world.members.members).toHaveLength(1);
    expect(created).toMatchObject({
      slug: "rahim-store",
      name: "Rahim Store",
      status: "ACTIVE",
      roleKeys: ["OWNER"],
    });
  });

  it("makes the creator the owner and takes the language from their profile", async () => {
    const world = aWorld();

    await world.useCase.execute(world.input);

    const [organization] = [...world.organizations.organizations.values()];
    expect(organization).toMatchObject({
      ownerUserId: world.input.actorUserId,
      createdByUserId: world.input.actorUserId,
      defaultLocale: "en",
      industryTemplateKey: "RETAIL",
    });
  });

  it("names the default location after the organization and puts the district in its address", async () => {
    const world = aWorld();

    await world.useCase.execute(world.input);

    expect(world.locations.locations[0]).toMatchObject({
      name: "Rahim Store",
      isDefault: true,
      locationType: "STORE",
      status: "ACTIVE",
      address: { district: "Dhaka" },
    });
  });

  it("gives the owner an active membership with the OWNER role at ALL locations and member number 1", async () => {
    const world = aWorld();

    await world.useCase.execute(world.input);

    const ownerRoleId = world.systemRoles.calls[0]?.ownerRoleId;
    expect(world.members.members[0]).toMatchObject({
      userId: world.input.actorUserId,
      status: "ACTIVE",
      displayName: "Rahim Uddin",
      employeeNumber: "1",
      assignments: [{ locationId: "ALL", roleId: ownerRoleId }],
    });
  });

  it("provisions the system roles for the new organization on behalf of the creator", async () => {
    const world = aWorld();

    const created = await world.useCase.execute(world.input);

    expect(world.systemRoles.calls).toHaveLength(1);
    expect(world.systemRoles.calls[0]).toMatchObject({
      organizationId: created.organizationId,
      actorUserId: world.input.actorUserId,
    });
  });

  it("answers a taken slug with SlugTakenError before it spends a member number", async () => {
    const world = aWorld();
    await world.useCase.execute(world.input);

    const second = world.useCase.execute({ ...world.input, name: "Another Store" });

    await expect(second).rejects.toBeInstanceOf(SlugTakenError);
    expect(world.memberNumbers.calls).toBe(1);
    expect(world.organizations.organizations.size).toBe(1);
  });

  it("rejects a reserved slug without touching any repository", async () => {
    const world = aWorld();

    const attempt = world.useCase.execute({ ...world.input, slug: "admin" });

    await expect(attempt).rejects.toBeInstanceOf(DomainRuleError);
    expect(world.organizations.organizations.size).toBe(0);
    expect(world.memberNumbers.calls).toBe(0);
  });

  it("rejects a caller whose account no longer exists", async () => {
    const world = aWorld();

    const attempt = world.useCase.execute({ ...world.input, actorUserId: newId() as UserId });

    await expect(attempt).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});

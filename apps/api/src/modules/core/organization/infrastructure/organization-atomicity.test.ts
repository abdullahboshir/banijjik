import { ALL_LOCATIONS, LOCATION_TYPE } from "@banijjik/contracts";
import {
  asId,
  newId,
  type InvitationId,
  type LocationId,
  type MemberId,
  type OrganizationId,
  type RoleId,
  type UserId,
} from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findRequestContext, runWithRequestContext } from "../../../../kernel/context/index.js";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  countAuditRows,
  inviteEmailAs,
  newActor,
} from "../../../../test-support/organization-tenant-world.js";
import { findSystemRoleId } from "../../../../test-support/rbac-world.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";
import { buildAuditRecorder } from "../../audit/index.js";
import { AssignmentGuard } from "../application/assignment-guard.js";
import type { EventPublisher } from "../application/ports/event-publisher.js";
import { AcceptInvitationUseCase } from "../application/use-cases/accept-invitation.use-case.js";
import { CreateInvitationUseCase } from "../application/use-cases/invitation.use-cases.js";
import { CreateLocationUseCase } from "../application/use-cases/location.use-cases.js";
import { UpdateMemberUseCase } from "../application/use-cases/member.use-cases.js";
import { UpdateProfileUseCase } from "../application/use-cases/profile.use-cases.js";
import { MongoInvitationRepository } from "./mongo-invitation.repository.js";
import { MongoLocationRepository } from "./mongo-location.repository.js";
import { MongoMemberNumberSequence } from "./mongo-member-number-sequence.js";
import { MongoMemberRepository } from "./mongo-member.repository.js";
import { MongoOrganizationRepository } from "./mongo-organization.repository.js";
import { MongoUnitOfWork } from "./mongo-unit-of-work.js";
import { RandomInvitationTokens } from "./random-invitation-tokens.js";

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi();
});

afterAll(async () => {
  await harness.dispose();
});

const FAILURE_MESSAGE = "the event could not be written";

/** An event port that fails after the audit entry and the change were written in the transaction. */
const failingEvents: EventPublisher = {
  publish: async () => {
    throw new Error(FAILURE_MESSAGE);
  },
};

function aWorld(): Promise<TwoOrganizations> {
  return createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
}

/** Runs `work` as a signed-in member of the organization, the way the tenant pipeline would. */
function asMemberOf<Result>(
  organizationId: string,
  userId: string,
  work: () => Promise<Result>,
): Promise<Result> {
  return runWithRequestContext(
    { requestId: newId(), organizationId, userId, allowedLocationIds: ALL_LOCATIONS },
    work,
  );
}

const audit = (): ReturnType<typeof buildAuditRecorder> => buildAuditRecorder(harness.clock);

/** A guard whose roles hold no keys, so only the transaction behaviour is under test. */
function openGuard(): AssignmentGuard {
  return new AssignmentGuard({
    roles: {
      findGrants: async (roleIds) =>
        new Map(
          roleIds.map((roleId) => [
            roleId,
            { roleId, isActive: true, isOwnerRole: false, permissionKeys: new Set<string>() },
          ]),
        ),
    },
    locations: new MongoLocationRepository(),
    permissions: { describeCaller: async () => ({ allLocations: [], byLocation: {} }) },
  });
}

describe("a change whose event cannot be written", () => {
  it("rolls back a profile rename with its audit entry", async () => {
    const world = await aWorld();
    const organizationId = world.organizationB;
    const useCase = new UpdateProfileUseCase({
      organizations: new MongoOrganizationRepository(),
      unitOfWork: new MongoUnitOfWork(),
      events: failingEvents,
      audit: audit(),
    });

    await expect(
      asMemberOf(organizationId, world.bob.userId, () =>
        useCase.execute({
          organizationId: asId<OrganizationId>(organizationId),
          actorUserId: asId<UserId>(world.bob.userId),
          name: "Renamed",
          version: 1,
        }),
      ),
    ).rejects.toThrow(FAILURE_MESSAGE);

    const stored = await world.bob.call("get", `/orgs/${organizationId}/profile`);
    expect(stored.body.data).toMatchObject({ name: "Org B", version: 1 });
    expect(
      await countAuditRows(harness.connections, {
        organizationId,
        action: "organization.organization.updated",
      }),
    ).toBe(0);
  });

  it("rolls back a new location with its audit entry", async () => {
    const world = await aWorld();
    const organizationId = world.organizationB;
    const useCase = new CreateLocationUseCase({
      locations: new MongoLocationRepository(),
      limits: { assertBelow: async () => undefined },
      unitOfWork: new MongoUnitOfWork(),
      events: failingEvents,
      audit: audit(),
      clock: harness.clock,
    });

    await expect(
      asMemberOf(organizationId, world.bob.userId, () =>
        useCase.execute({
          organizationId: asId<OrganizationId>(organizationId),
          actorUserId: asId<UserId>(world.bob.userId),
          name: "Ghost",
          locationType: LOCATION_TYPE.STORE,
        }),
      ),
    ).rejects.toThrow(FAILURE_MESSAGE);

    const list = await world.bob.call("get", `/orgs/${organizationId}/locations`);
    expect(list.body.data).toHaveLength(1);
    expect(
      await countAuditRows(harness.connections, {
        organizationId,
        action: "organization.location.created",
      }),
    ).toBe(0);
  });

  it("rolls back a change of assignments with its audit entry", async () => {
    const world = await aWorld();
    const organizationId = world.organizationA;
    const managerRoleId = await findSystemRoleId(harness.connections, organizationId, "MANAGER");
    const useCase = new UpdateMemberUseCase({
      members: new MongoMemberRepository(),
      organizations: new MongoOrganizationRepository(),
      guard: openGuard(),
      unitOfWork: new MongoUnitOfWork(),
      events: failingEvents,
      audit: audit(),
    });

    await expect(
      asMemberOf(organizationId, world.alice.userId, () =>
        useCase.execute({
          organizationId: asId<OrganizationId>(organizationId),
          actorUserId: asId<UserId>(world.alice.userId),
          memberId: asId<MemberId>(world.samMemberId),
          version: 1,
          changes: {
            assignments: [
              {
                locationId: asId<LocationId>(world.locationA1),
                roleId: asId<RoleId>(managerRoleId),
              },
            ],
          },
        }),
      ),
    ).rejects.toThrow(FAILURE_MESSAGE);

    const sam = await world.alice.call(
      "get",
      `/orgs/${organizationId}/members/${world.samMemberId}`,
    );
    expect(sam.body.data.version).toBe(1);
    expect(
      await countAuditRows(harness.connections, {
        organizationId,
        action: "organization.member.updated",
      }),
    ).toBe(0);
  });

  it("rolls back an invitation with its audit entry", async () => {
    const world = await aWorld();
    const organizationId = world.organizationA;
    const staffRoleId = await findSystemRoleId(harness.connections, organizationId);
    const useCase = new CreateInvitationUseCase({
      invitations: new MongoInvitationRepository(),
      members: new MongoMemberRepository(),
      users: { findUserIdByIdentifier: async () => undefined },
      guard: openGuard(),
      limits: { assertBelow: async () => undefined },
      tokens: new RandomInvitationTokens(),
      unitOfWork: new MongoUnitOfWork(),
      events: failingEvents,
      audit: audit(),
      clock: harness.clock,
    });

    await expect(
      asMemberOf(organizationId, world.alice.userId, () =>
        useCase.execute({
          organizationId: asId<OrganizationId>(organizationId),
          actorUserId: asId<UserId>(world.alice.userId),
          email: "ghost@example.com",
          assignments: [
            { locationId: asId<LocationId>(world.locationA1), roleId: asId<RoleId>(staffRoleId) },
          ],
        }),
      ),
    ).rejects.toThrow(FAILURE_MESSAGE);

    expect(
      await harness.connections.platform
        .collection("invitations")
        .countDocuments({ organizationId }),
    ).toBe(0);
    expect(
      await countAuditRows(harness.connections, {
        organizationId,
        action: "organization.invitation.created",
      }),
    ).toBe(0);
  });

  it("rolls back an accepted invitation: no member, the invitation stays pending", async () => {
    const world = await aWorld();
    const organizationId = world.organizationA;
    const invitee = await newActor(harness.app);
    const roleId = await findSystemRoleId(harness.connections, organizationId);
    const invited = await inviteEmailAs(world.alice, organizationId, {
      email: invitee.person.email,
      assignments: [{ locationId: world.locationA1, roleId }],
    });
    const stored = await asMemberOf(organizationId, world.alice.userId, () =>
      new MongoInvitationRepository().findById(asId<InvitationId>(invited.invitationId)),
    );
    const useCase = new AcceptInvitationUseCase({
      tokens: new RandomInvitationTokens(),
      lookup: {
        findByTokenHash: async () =>
          stored === undefined
            ? undefined
            : { invitation: stored, organizationName: "Org A", invitedByDisplayName: "Owner" },
      },
      users: {
        findIdentifiers: async () => ({ email: invitee.person.email, phoneE164: undefined }),
      },
      actorProfiles: { findProfile: async () => ({ name: "Invitee", preferredLocale: "bn" }) },
      invitations: new MongoInvitationRepository(),
      members: new MongoMemberRepository(),
      guard: openGuard(),
      memberNumbers: new MongoMemberNumberSequence(),
      myOrganizations: { execute: async () => [] },
      contextRunner: {
        run: (id, work) =>
          runWithRequestContext(
            {
              ...(findRequestContext() ?? { requestId: newId() }),
              organizationId: id,
              allowedLocationIds: ALL_LOCATIONS,
            },
            work,
          ),
      },
      unitOfWork: new MongoUnitOfWork(),
      events: failingEvents,
      audit: audit(),
      clock: harness.clock,
    });

    await expect(
      runWithRequestContext({ requestId: newId(), userId: invitee.userId }, () =>
        useCase.execute({ token: invited.token, userId: asId<UserId>(invitee.userId) }),
      ),
    ).rejects.toThrow(FAILURE_MESSAGE);

    const invitation = await harness.connections.platform
      .collection("invitations")
      .findOne({ invitationId: invited.invitationId });
    expect(invitation?.["status"]).toBe("PENDING");
    expect(
      await harness.connections.platform
        .collection("members")
        .countDocuments({ organizationId, userId: invitee.userId }),
    ).toBe(0);
    expect(
      await countAuditRows(harness.connections, {
        organizationId,
        action: "organization.member.joined",
      }),
    ).toBe(0);
  });
});

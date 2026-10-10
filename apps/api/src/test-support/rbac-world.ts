import { ALL_LOCATIONS, SYSTEM_ROLE_KEY, type SystemRoleKey } from "@banijjik/contracts";
import { asId, type LocationId, type OrganizationId } from "@banijjik/ids";
import type { Express } from "express";
import type { DatabaseConnections } from "../kernel/db/index.js";
import { Member } from "../modules/core/organization/domain/member.entity.js";
import { MongoMemberRepository } from "../modules/core/organization/infrastructure/mongo-member.repository.js";
import { registerViaApi } from "./auth-api-scenarios.js";
import { withOrganizationContext } from "./organization-context.js";
import { ApiActor } from "./two-organizations.js";

export interface TestAssignment {
  /** A location ID or "ALL". */
  readonly locationId: string;
  readonly roleId: string;
}

export interface AddedMember {
  readonly actor: ApiActor;
  readonly memberId: string;
}

/** The roleId of a system role of an organization. */
export async function findSystemRoleId(
  connections: DatabaseConnections,
  organizationId: string,
  roleKey: SystemRoleKey = SYSTEM_ROLE_KEY.STAFF,
): Promise<string> {
  const role = await connections.platform.collection("roles").findOne({ organizationId, roleKey });
  if (role === null) throw new Error(`system role ${roleKey} missing`);
  return role["roleId"] as string;
}

/**
 * Registers a new person and adds them to an organization as an active member with the given
 * assignments. Invitations do not exist yet, so the member is written through the repository.
 */
export async function addMemberWithAssignments(
  app: Express,
  organizationId: string,
  assignments: readonly TestAssignment[],
): Promise<AddedMember> {
  const actor = new ApiActor(app, await registerViaApi(app));
  const member = Member.joinActive({
    organizationId: asId<OrganizationId>(organizationId),
    userId: asId(actor.userId),
    displayName: "Test Member",
    // Safe: the IDs come from roles and locations written through the real use cases (UUID v7).
    assignments: assignments.map(({ locationId, roleId }) => ({
      locationId: locationId === ALL_LOCATIONS ? ALL_LOCATIONS : asId<LocationId>(locationId),
      roleId: asId(roleId),
    })),
    employeeNumber: undefined,
    createdByUserId: null,
    now: new Date(),
  });
  await withOrganizationContext(organizationId, () => new MongoMemberRepository().insert(member));
  return { actor, memberId: member.memberId };
}

/**
 * Replaces a member's assignments the way the member endpoints will: the member version goes up,
 * which is what the permission cache keys on.
 */
export async function reassignMember(
  connections: DatabaseConnections,
  memberId: string,
  assignments: readonly TestAssignment[],
): Promise<void> {
  await connections.platform
    .collection("members")
    .updateOne({ memberId }, { $set: { assignments: [...assignments] }, $inc: { version: 1 } });
}

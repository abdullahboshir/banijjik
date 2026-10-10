import { ALL_LOCATIONS, ORGANIZATION_STATUS, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { DatabaseConnections } from "../kernel/db/index.js";
import { Member } from "../modules/core/organization/domain/member.entity.js";
import { MongoMemberRepository } from "../modules/core/organization/infrastructure/mongo-member.repository.js";

import { withOrganizationContext } from "./organization-context.js";

const MANAGER_NOT_FOUND = "the MANAGER system role was not found";

/**
 * Adds an existing user to an organization as an active MANAGER at all locations. Invitations are
 * not built yet, so tests that need a second member write the record through the repository.
 */
export async function addManagerMember(
  connections: DatabaseConnections,
  organization: { organizationId: string; userId: string },
): Promise<void> {
  const managerRole = await connections.platform
    .collection("roles")
    .findOne({ organizationId: organization.organizationId, roleKey: SYSTEM_ROLE_KEY.MANAGER });
  if (managerRole === null) throw new Error(MANAGER_NOT_FOUND);
  const userId = asId<UserId>(organization.userId);
  const member = Member.joinActive({
    organizationId: asId<OrganizationId>(organization.organizationId),
    userId,
    displayName: "Added Manager",
    // Safe: the role id was written by organization creation, so it is a valid UUID v7 string.
    assignments: [{ locationId: ALL_LOCATIONS, roleId: asId(managerRole["roleId"] as string) }],
    employeeNumber: undefined,
    createdByUserId: userId,
    now: new Date(),
  });
  await withOrganizationContext(organization.organizationId, () =>
    new MongoMemberRepository().insert(member),
  );
}

/** Closes an organization directly in the database; there is no close use case yet (card 1.8 and later). */
export async function closeOrganization(
  connections: DatabaseConnections,
  organizationId: string,
): Promise<void> {
  await connections.platform
    .collection("organizations")
    .updateOne({ organizationId }, { $set: { status: ORGANIZATION_STATUS.CLOSED } });
}

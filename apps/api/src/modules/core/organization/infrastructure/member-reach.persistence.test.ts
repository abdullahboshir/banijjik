import { ALL_LOCATIONS, MEMBER_STATUS } from "@banijjik/contracts";
import {
  asId,
  newId,
  type LocationId,
  type OrganizationId,
  type RoleId,
  type UserId,
} from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initializeModels, type DatabaseConnections } from "../../../../kernel/db/index.js";
import { withOrganizationContext } from "../../../../test-support/organization-context.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../../../test-support/test-databases.js";
import { Member, type Assignment } from "../domain/member.entity.js";
import { isWithinReach, type Reach } from "../domain/reach.js";
import { assignmentsReachFilter } from "./assignments-reach-filter.js";
import { MongoMemberRepository } from "./mongo-member.repository.js";
import { registerOrganizationModels } from "./register-organization-models.js";

registerOrganizationModels();

const organizationId = newId();
const LOCATION_ONE = asId<LocationId>(newId());
const LOCATION_TWO = asId<LocationId>(newId());
const LOCATION_THREE = asId<LocationId>(newId());
const ROLE = asId<RoleId>(newId());
const members = new MongoMemberRepository();

let connections: DatabaseConnections;

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

function assign(locationId: LocationId | typeof ALL_LOCATIONS): Assignment {
  return { locationId, roleId: ROLE };
}

const STORED_ASSIGNMENTS: readonly (readonly Assignment[])[] = [
  [assign(LOCATION_ONE)],
  [assign(LOCATION_TWO)],
  [assign(LOCATION_ONE), assign(LOCATION_TWO)],
  [assign(LOCATION_ONE), assign(LOCATION_TWO), assign(LOCATION_THREE)],
  [assign(ALL_LOCATIONS)],
];

const REACHES: readonly Reach[] = [
  "ALL",
  [LOCATION_ONE],
  [LOCATION_TWO],
  [LOCATION_ONE, LOCATION_TWO],
  [LOCATION_ONE, LOCATION_TWO, LOCATION_THREE],
  [],
];

async function insertStoredMembers(): Promise<Member[]> {
  const inserted: Member[] = [];
  for (const assignments of STORED_ASSIGNMENTS) {
    const member = Member.joinActive({
      organizationId: asId<OrganizationId>(organizationId),
      userId: asId<UserId>(newId()),
      displayName: `Member ${inserted.length}`,
      assignments,
      employeeNumber: undefined,
      createdByUserId: null,
      now: new Date(),
    });
    await withOrganizationContext(organizationId, () => members.insert(member));
    inserted.push(member);
  }
  return inserted;
}

function winningPlanIndexNames(plan: unknown): string[] {
  const text = JSON.stringify(plan);
  return [...text.matchAll(/"indexName":"([^"]+)"/g)].map((match) => match[1] ?? "");
}

describe("the member list reach filter", () => {
  it("selects in the database exactly the members that isWithinReach accepts", async () => {
    const inserted = await insertStoredMembers();

    for (const reach of REACHES) {
      const listed = await withOrganizationContext(organizationId, () =>
        members.list({ page: 1, limit: 100, reach }),
      );
      const expected = inserted
        .filter((member) => isWithinReach(member.assignments, reach))
        .map((member) => member.memberId)
        .sort();
      expect(listed.items.map((member) => member.memberId).sort()).toEqual(expected);
    }
  });

  it("is answered through an index that starts with organizationId", async () => {
    await insertStoredMembers();
    const filter = {
      organizationId,
      status: MEMBER_STATUS.ACTIVE,
      ...assignmentsReachFilter([LOCATION_ONE]),
    };

    const explained = await connections.platform
      .collection("members")
      .find(filter)
      .sort({ displayName: 1, memberId: 1 })
      .limit(21)
      .explain("queryPlanner");

    const names = winningPlanIndexNames(explained["queryPlanner"]["winningPlan"]);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(name).toMatch(/^organizationId_1/);
  });
});

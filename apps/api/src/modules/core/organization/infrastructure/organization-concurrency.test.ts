import { LOCATION_STATUS } from "@banijjik/contracts";
import {
  asId,
  newId,
  type LocationId,
  type OrganizationId,
  type RoleId,
  type UserId,
} from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { withOrganizationContext } from "../../../../test-support/organization-context.js";
import { findSystemRoleId } from "../../../../test-support/rbac-world.js";
import { createTwoOrganizations } from "../../../../test-support/two-organizations.js";
import { Location } from "../domain/location.entity.js";
import { Member } from "../domain/member.entity.js";
import { MongoLocationRepository } from "./mongo-location.repository.js";
import { MongoMemberRepository } from "./mongo-member.repository.js";

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi();
});

afterAll(async () => {
  await harness.dispose();
});

const ROUNDS = 3;
const CONCURRENT_REQUESTS = 10;
const SERVICE_BUSY_OR_LIMIT = [422, 503];

describe("creates that are checked against a package limit run one after the other", () => {
  it.each(Array.from({ length: ROUNDS }, (_unused, round) => round + 1))(
    "lets exactly one of %i x 10 concurrent location creates take the last free slot",
    async () => {
      const world = await createTwoOrganizations(harness.app, harness.connections, {
        industryTemplateKey: "RETAIL",
      });
      // Org B holds its default location; the BUNDLE trial allows 2, so one slot is free.
      const attempts = Array.from({ length: CONCURRENT_REQUESTS }, (_unused, index) =>
        world.bob.call("post", `/orgs/${world.organizationB}/locations`, {
          name: `Racer ${index}`,
          locationType: "STORE",
        }),
      );

      const answers = await Promise.all(attempts);

      const statuses = answers.map((answer) => answer.status);
      expect(statuses.filter((status) => status === 201)).toHaveLength(1);
      for (const status of statuses.filter((candidate) => candidate !== 201)) {
        expect(SERVICE_BUSY_OR_LIMIT).toContain(status);
      }
      const active = await harness.connections.platform
        .collection("locations")
        .countDocuments({ organizationId: world.organizationB, status: LOCATION_STATUS.ACTIVE });
      expect(active).toBe(2);
    },
  );

  it("never lets pending invitations overshoot the members limit under concurrent invites", async () => {
    const world = await createTwoOrganizations(harness.app, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    const organizationId = world.organizationB;
    const roleId = await findSystemRoleId(harness.connections, organizationId);

    // The owner is 1 of 10 members, so 9 invitations fit; 15 compete.
    const answers = await Promise.all(
      Array.from({ length: 15 }, (_unused, index) =>
        world.bob.call("post", `/orgs/${organizationId}/invitations`, {
          email: `race${index}-${Date.now()}@example.com`,
          assignments: [{ locationId: world.locationB1, roleId }],
        }),
      ),
    );

    const created = answers.filter((answer) => answer.status === 201).length;
    for (const answer of answers.filter((candidate) => candidate.status !== 201)) {
      expect(SERVICE_BUSY_OR_LIMIT).toContain(answer.status);
    }
    const stored = await harness.connections.platform
      .collection("invitations")
      .countDocuments({ organizationId });
    expect(stored).toBe(created);
    expect(created).toBeLessThanOrEqual(9);
  });
});

async function insertLocation(organizationId: string, name: string): Promise<string> {
  const base = Location.createDefault({
    organizationId: asId<OrganizationId>(organizationId),
    name,
    district: undefined,
    createdByUserId: null,
    now: new Date(),
  });
  const location = Location.restore({ ...base, isDefault: false });
  await withOrganizationContext(organizationId, () =>
    new MongoLocationRepository().insert(location),
  );
  return location.locationId;
}

async function insertMember(
  organizationId: string,
  roleId: string,
  locationId: string,
): Promise<string> {
  const member = Member.joinActive({
    organizationId: asId<OrganizationId>(organizationId),
    userId: asId<UserId>(newId()),
    displayName: "Racer",
    // Safe: both IDs come from rows written through the real code (UUID v7).
    assignments: [{ locationId: asId<LocationId>(locationId), roleId: asId<RoleId>(roleId) }],
    employeeNumber: undefined,
    createdByUserId: null,
    now: new Date(),
  });
  await withOrganizationContext(organizationId, () => new MongoMemberRepository().insert(member));
  return member.memberId;
}

describe("archiving a location against assigning a member to it", () => {
  it.each(Array.from({ length: ROUNDS }, (_unused, round) => round + 1))(
    "leaves no active member on an archived location after 10 concurrent pairs, round %i",
    async (round) => {
      const world = await createTwoOrganizations(harness.app, harness.connections, {
        industryTemplateKey: "RETAIL",
      });
      const organizationId = world.organizationA;
      const roleId = await findSystemRoleId(harness.connections, organizationId);
      const pairs = await Promise.all(
        Array.from({ length: CONCURRENT_REQUESTS }, async (_unused, index) => {
          const locationId = await insertLocation(organizationId, `Race ${round}-${index}`);
          const memberId = await insertMember(organizationId, roleId, world.locationA1);
          return { locationId, memberId };
        }),
      );

      const answers = await Promise.all(
        pairs.flatMap(({ locationId, memberId }) => [
          world.alice.call("post", `/orgs/${organizationId}/locations/${locationId}/archive`, {
            version: 1,
          }),
          world.alice.call("patch", `/orgs/${organizationId}/members/${memberId}`, {
            assignments: [{ locationId, roleId }],
            version: 1,
          }),
        ]),
      );

      for (const answer of answers) {
        expect([200, 400, 422, 503]).toContain(answer.status);
      }
      const archived = await harness.connections.platform
        .collection("locations")
        .find({ organizationId, status: LOCATION_STATUS.ARCHIVED })
        .toArray();
      const archivedIds = new Set(archived.map((row) => row["locationId"]));
      const activeMembers = await harness.connections.platform
        .collection("members")
        .find({ organizationId, status: "ACTIVE" })
        .toArray();
      const strandedMembers = activeMembers.filter((member) =>
        (member["assignments"] as { locationId: string }[]).some((assignment) =>
          archivedIds.has(assignment.locationId),
        ),
      );
      expect(strandedMembers).toEqual([]);
    },
  );
});

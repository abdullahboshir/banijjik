import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { asId, type LocationId, type OrganizationId, type RoleId } from "@banijjik/ids";
import type { Express } from "express";
import type { Response } from "supertest";
import { callApi, asCookies, type ApiCall } from "./auth-api-client.js";
import { registerViaApi, type RegisteredPerson } from "./auth-api-scenarios.js";
import type { DatabaseConnections } from "../kernel/db/index.js";
import { Location } from "../modules/core/organization/domain/location.entity.js";
import { Member } from "../modules/core/organization/domain/member.entity.js";
import { MongoLocationRepository } from "../modules/core/organization/infrastructure/mongo-location.repository.js";
import { MongoMemberRepository } from "../modules/core/organization/infrastructure/mongo-member.repository.js";
import { withOrganizationContext } from "./organization-context.js";

/** A signed-in person who can call the real API. */
export class ApiActor {
  constructor(
    private readonly app: Express,
    readonly person: RegisteredPerson,
  ) {}

  call(method: ApiCall["method"], path: string, body?: object): Promise<Response> {
    return callApi(this.app, {
      method,
      path: `/api/v1${path}`,
      cookies: asCookies(this.person.session),
      ...(body === undefined ? {} : { body }),
    });
  }

  get userId(): string {
    return this.person.me.userId;
  }
}

export interface TwoOrganizations {
  readonly organizationA: string;
  readonly organizationB: string;
  /** The default location of A, and a second one. */
  readonly locationA1: string;
  readonly locationA2: string;
  readonly locationB1: string;
  readonly alice: ApiActor;
  readonly bob: ApiActor;
  /** Staff of A assigned to A-L1 only. */
  readonly sam: ApiActor;
  readonly samMemberId: string;
}

let issuedSlugs = 0;

async function createOrganization(
  actor: ApiActor,
  label: string,
  organizationFields: object,
): Promise<string> {
  issuedSlugs += 1;
  const response = await actor.call("post", "/me/orgs", {
    name: `Org ${label}`,
    slug: `isolation-${label.toLowerCase()}-${issuedSlugs}`,
    ...organizationFields,
  });
  if (response.status !== 201) throw new Error(`organization ${label} failed: ${response.status}`);
  return response.body.data.organizationId as string;
}

async function findDefaultLocation(
  connections: DatabaseConnections,
  organizationId: string,
): Promise<LocationId> {
  const row = await connections.platform
    .collection("locations")
    .findOne({ organizationId, isDefault: true });
  if (row === null) throw new Error("default location missing");
  return asId<LocationId>(row["locationId"] as string);
}

async function addSecondLocation(organizationId: string): Promise<string> {
  const base = Location.createDefault({
    organizationId: asId<OrganizationId>(organizationId),
    name: "A-L2",
    district: undefined,
    createdByUserId: null,
    now: new Date(),
  });
  const second = Location.restore({ ...base, isDefault: false });
  await withOrganizationContext(organizationId, () => new MongoLocationRepository().insert(second));
  return second.locationId;
}

interface StaffPlacement {
  readonly organizationId: string;
  readonly sam: ApiActor;
  readonly locationId: LocationId;
}

async function addStaffMember(
  connections: DatabaseConnections,
  placement: StaffPlacement,
): Promise<string> {
  const { organizationId, sam, locationId } = placement;
  const role = await connections.platform
    .collection("roles")
    .findOne({ organizationId, roleKey: SYSTEM_ROLE_KEY.STAFF });
  if (role === null) throw new Error("staff role missing");
  const member = Member.joinActive({
    organizationId: asId<OrganizationId>(organizationId),
    userId: asId(sam.userId),
    displayName: "Sam",
    // Safe: the role id was written by organization creation, so it is a valid UUID v7 string.
    assignments: [{ locationId, roleId: asId<RoleId>(role["roleId"] as string) }],
    employeeNumber: undefined,
    createdByUserId: null,
    now: new Date(),
  });
  await withOrganizationContext(organizationId, () => new MongoMemberRepository().insert(member));
  return member.memberId;
}

/**
 * Builds the world the isolation suite runs in, through the real API and use cases:
 * org A (owner Alice, locations A-L1 and A-L2, staff Sam on A-L1 only) and org B (owner Bob).
 * Invitations do not exist yet, so Sam's membership is written through the member repository.
 */
export async function createTwoOrganizations(
  app: Express,
  connections: DatabaseConnections,
  /** Extra fields of the create-organization body. The test file supplies them: bodies that name an industry template live in *.test.ts (lint R16). */
  organizationFields: object,
): Promise<TwoOrganizations> {
  const alice = new ApiActor(app, await registerViaApi(app));
  const bob = new ApiActor(app, await registerViaApi(app));
  const sam = new ApiActor(app, await registerViaApi(app));
  const organizationA = await createOrganization(alice, "A", organizationFields);
  const organizationB = await createOrganization(bob, "B", organizationFields);
  const locationA1 = await findDefaultLocation(connections, organizationA);
  const locationA2 = await addSecondLocation(organizationA);
  const samMemberId = await addStaffMember(connections, {
    organizationId: organizationA,
    sam,
    locationId: locationA1,
  });
  const locationB1 = await findDefaultLocation(connections, organizationB);
  return {
    organizationA,
    organizationB,
    locationA1,
    locationA2,
    locationB1,
    alice,
    bob,
    sam,
    samMemberId,
  };
}

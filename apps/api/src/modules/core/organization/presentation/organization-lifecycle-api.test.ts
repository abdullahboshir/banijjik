import { PAST_DUE_GRACE_DAYS, SYSTEM_ROLE_KEY, TRIAL_DAYS } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { callApi } from "../../../../test-support/auth-api-client.js";
import { loginViaApi } from "../../../../test-support/auth-api-scenarios.js";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { inviteEmailAs, newActor } from "../../../../test-support/organization-tenant-world.js";
import { findSystemRoleId } from "../../../../test-support/rbac-world.js";
import {
  ApiActor,
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi();
});

afterAll(async () => {
  await harness.dispose();
});

const SECONDS_PER_DAY = 24 * 60 * 60;
const INVITATION_VALIDITY_DAYS = 7;

function aWorld(): Promise<TwoOrganizations> {
  return createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
}

async function signInAgain(actor: ApiActor): Promise<ApiActor> {
  // The test clock moved far past the access token, so the person signs in again.
  return new ApiActor(harness.app, {
    ...actor.person,
    session: await loginViaApi(harness.app, actor.person),
  });
}

describe("an invitation that is not accepted in time", () => {
  it("reads as EXPIRED, its link stops working and it cannot be revoked", async () => {
    const world = await aWorld();
    const invitee = await newActor(harness.app);
    const roleId = await findSystemRoleId(harness.connections, world.organizationA);
    const invited = await inviteEmailAs(world.alice, world.organizationA, {
      email: invitee.person.email,
      assignments: [{ locationId: world.locationA1, roleId }],
    });
    const base = `/orgs/${world.organizationA}/invitations`;

    harness.clock.advanceSeconds(INVITATION_VALIDITY_DAYS * SECONDS_PER_DAY + 1);
    const owner = await signInAgain(world.alice);
    const person = await signInAgain(invitee);
    const expired = await owner.call("get", `${base}?status=EXPIRED`);
    const pending = await owner.call("get", `${base}?status=PENDING`);
    const preview = await callApi(harness.app, {
      method: "get",
      path: `/api/v1/invitations/${invited.token}`,
    });
    const accept = await person.call("post", `/invitations/${invited.token}/accept`);
    const revoke = await owner.call("post", `${base}/${invited.invitationId}/revoke`, {
      version: 1,
    });

    expect(expired.body.data.map((row: { status: string }) => row.status)).toEqual(["EXPIRED"]);
    expect(pending.body.data).toEqual([]);
    expect(preview.status).toBe(404);
    expect(accept.status).toBe(404);
    expect(revoke.status).toBe(409);
    expect(revoke.body.error.details).toEqual({ currentStatus: "EXPIRED" });
  });
});

describe("a business whose subscription ran out (read-only)", () => {
  it("keeps every read working and refuses every write of the new endpoints", async () => {
    const world = await aWorld();
    const roleId = await findSystemRoleId(
      harness.connections,
      world.organizationB,
      SYSTEM_ROLE_KEY.STAFF,
    );
    harness.clock.advanceSeconds((TRIAL_DAYS + PAST_DUE_GRACE_DAYS) * SECONDS_PER_DAY + 1);
    const owner = await signInAgain(world.bob);
    const org = `/orgs/${world.organizationB}`;

    const reads = [
      await owner.call("get", `${org}/profile`),
      await owner.call("get", `${org}/locations`),
      await owner.call("get", `${org}/members`),
      await owner.call("get", `${org}/invitations`),
    ];
    const writes = [
      await owner.call("patch", `${org}/profile`, { name: "Too late", version: 1 }),
      await owner.call("post", `${org}/locations`, { name: "Late", locationType: "STORE" }),
      await owner.call("patch", `${org}/locations/${world.locationB1}`, {
        name: "Late",
        version: 1,
      }),
      await owner.call("post", `${org}/invitations`, {
        email: "late@example.com",
        assignments: [{ locationId: world.locationB1, roleId }],
      }),
    ];

    expect(reads.map((response) => response.status)).toEqual([200, 200, 200, 200]);
    for (const response of writes) {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("ORG_READ_ONLY");
    }
  });

  it("never raised the no-owner-module warning: every new route belongs to the organization module", () => {
    const warnings = harness.logs
      .lines()
      .filter((line) => line["event"] === "entitlement.route_without_module");

    expect(warnings).toEqual([]);
  });
});

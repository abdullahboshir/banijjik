import { ALL_LOCATIONS, ERROR_CODE, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { APPROVAL_ACTION, IAM_OWNER_SELF_APPROVAL_SETTING_KEY } from "@banijjik/contracts/iam";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { API_PASSWORD } from "../../../../test-support/auth-api-scenarios.js";
import { freshIp } from "../../../../test-support/auth-api-client.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";
import { APPROVAL_RATE_LIMIT } from "../domain/approval-limits.js";

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi();
});

afterAll(async () => {
  await harness.dispose();
});

function aWorld(): Promise<TwoOrganizations> {
  return createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
}

function pinPath(organizationId: string): string {
  return `/orgs/${organizationId}/me/approval-pin`;
}

function approvalsPath(organizationId: string): string {
  return `/orgs/${organizationId}/approvals`;
}

describe("approval PIN", () => {
  it("sets a PIN with the current password and never returns the PIN", async () => {
    const world = await aWorld();
    const response = await world.alice.call("put", pinPath(world.organizationA), {
      currentPassword: API_PASSWORD,
      pin: "1234",
    });
    expect(response.status).toBe(204);
    expect(JSON.stringify(response.body)).not.toContain("1234");
    const stored = await harness.connections.platform
      .collection("members")
      .findOne({ organizationId: world.organizationA, userId: world.alice.userId });
    expect(stored?.["approvalPinHash"]).toEqual(expect.any(String));
    expect(JSON.stringify(stored)).not.toContain("1234");
  });

  it("refuses a member without iam.approval.grant", async () => {
    const world = await aWorld();
    const staffRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.STAFF,
    );
    const staff = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: ALL_LOCATIONS, roleId: staffRoleId },
    ]);
    const response = await staff.actor.call("put", pinPath(world.organizationA), {
      currentPassword: API_PASSWORD,
      pin: "1234",
    });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(ERROR_CODE.FORBIDDEN);
  });

  it("refuses a wrong account password when setting the PIN", async () => {
    const world = await aWorld();
    const response = await world.alice.call("put", pinPath(world.organizationA), {
      currentPassword: "this is the wrong password",
      pin: "1234",
    });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ERROR_CODE.UNAUTHENTICATED);
  });
});

describe("POST /approvals", () => {
  async function managerWithPin(world: TwoOrganizations): Promise<{
    memberId: string;
    actor: TwoOrganizations["alice"];
  }> {
    const managerRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const manager = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: managerRoleId },
    ]);
    const pinResponse = await manager.actor.call("put", pinPath(world.organizationA), {
      currentPassword: API_PASSWORD,
      pin: "4321",
    });
    expect(pinResponse.status).toBe(204);
    return { memberId: manager.memberId, actor: manager.actor };
  }

  it("returns a token for a correct PIN", async () => {
    const world = await aWorld();
    const manager = await managerWithPin(world);
    const response = await world.sam.call("post", approvalsPath(world.organizationA), {
      action: APPROVAL_ACTION.REFUND,
      subjectKey: "order:demo",
      locationId: world.locationA1,
      approverMemberId: manager.memberId,
      pin: "4321",
    });
    expect(response.status).toBe(200);
    expect(response.body.data.approvalToken).toEqual(expect.any(String));
    expect(response.body.data.expiresAt).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toContain("4321");
  });

  it("answers 400 with no hint for a wrong PIN", async () => {
    const world = await aWorld();
    const manager = await managerWithPin(world);
    const response = await world.sam.call("post", approvalsPath(world.organizationA), {
      action: APPROVAL_ACTION.REFUND,
      subjectKey: "order:demo",
      locationId: world.locationA1,
      approverMemberId: manager.memberId,
      pin: "0000",
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODE.APPROVAL_INVALID);
    expect(response.body.error.messageKey).toBe("errors.approval_invalid");
  });

  it("locks the PIN after five failures", async () => {
    const world = await aWorld();
    const manager = await managerWithPin(world);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const failed = await world.sam.call("post", approvalsPath(world.organizationA), {
        action: APPROVAL_ACTION.REFUND,
        subjectKey: `order:fail-${String(attempt)}`,
        locationId: world.locationA1,
        approverMemberId: manager.memberId,
        pin: "0000",
      });
      expect(failed.status).toBe(400);
    }
    const fifth = await world.sam.call("post", approvalsPath(world.organizationA), {
      action: APPROVAL_ACTION.REFUND,
      subjectKey: "order:fail-4",
      locationId: world.locationA1,
      approverMemberId: manager.memberId,
      pin: "0000",
    });
    expect(fifth.status).toBe(423);
    expect(fifth.body.error.code).toBe(ERROR_CODE.APPROVAL_PIN_LOCKED);
  });

  it("locks after parallel wrong PINs without verifying more than five (R1-1)", async () => {
    const world = await aWorld();
    const manager = await managerWithPin(world);
    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, attempt) =>
        world.sam.call("post", approvalsPath(world.organizationA), {
          action: APPROVAL_ACTION.REFUND,
          subjectKey: `order:parallel-${String(attempt)}`,
          locationId: world.locationA1,
          approverMemberId: manager.memberId,
          pin: "0000",
        }),
      ),
    );
    const invalid = responses.filter((response) => response.status === 400);
    const locked = responses.filter((response) => response.status === 423);
    // Reserved slots verify (400 for counts 1–4, 423 for the 5th); the rest refuse without verify.
    expect(invalid.length).toBeLessThanOrEqual(4);
    expect(invalid.length + Math.min(locked.length, 1)).toBeLessThanOrEqual(5);
    expect(locked.length).toBeGreaterThanOrEqual(5);
    const stored = await harness.connections.platform
      .collection("members")
      .findOne({ memberId: manager.memberId });
    expect(stored?.["approvalPinFailedCount"]).toBe(5);
    expect(stored?.["approvalPinLockedUntil"]).toEqual(expect.any(Date));

    const eleventh = await world.sam.call("post", approvalsPath(world.organizationA), {
      action: APPROVAL_ACTION.REFUND,
      subjectKey: "order:parallel-11",
      locationId: world.locationA1,
      approverMemberId: manager.memberId,
      pin: "0000",
    });
    expect(eleventh.status).toBe(423);
    expect(eleventh.body.error.code).toBe(ERROR_CODE.APPROVAL_PIN_LOCKED);
  });

  it("answers 400 when the approver lacks the permission at that location", async () => {
    const world = await aWorld();
    const managerRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const manager = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: managerRoleId },
    ]);
    await manager.actor.call("put", pinPath(world.organizationA), {
      currentPassword: API_PASSWORD,
      pin: "4321",
    });
    const response = await world.sam.call("post", approvalsPath(world.organizationA), {
      action: APPROVAL_ACTION.REFUND,
      subjectKey: "order:other-loc",
      locationId: world.locationA2,
      approverMemberId: manager.memberId,
      pin: "4321",
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODE.APPROVAL_INVALID);
  });

  it("answers 400 for a member of another organization", async () => {
    const world = await aWorld();
    const managerRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationB,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const other = await addMemberWithAssignments(harness.app, world.organizationB, [
      { locationId: ALL_LOCATIONS, roleId: managerRoleId },
    ]);
    await other.actor.call("put", pinPath(world.organizationB), {
      currentPassword: API_PASSWORD,
      pin: "9999",
    });
    const response = await world.sam.call("post", approvalsPath(world.organizationA), {
      action: APPROVAL_ACTION.REFUND,
      subjectKey: "order:cross",
      locationId: world.locationA1,
      approverMemberId: other.memberId,
      pin: "9999",
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODE.APPROVAL_INVALID);
  });

  it("lets an OWNER self-approve by default and refuses a MANAGER self-approve", async () => {
    const world = await aWorld();
    await world.alice.call("put", pinPath(world.organizationA), {
      currentPassword: API_PASSWORD,
      pin: "1111",
    });
    const aliceMember = await harness.connections.platform
      .collection("members")
      .findOne({ organizationId: world.organizationA, userId: world.alice.userId });
    const ownerSelf = await world.alice.call("post", approvalsPath(world.organizationA), {
      action: APPROVAL_ACTION.DISCOUNT,
      subjectKey: "quote:owner",
      locationId: world.locationA1,
      approverMemberId: aliceMember?.["memberId"],
      pin: "1111",
    });
    expect(ownerSelf.status).toBe(200);

    const manager = await managerWithPin(world);
    const managerSelf = await manager.actor.call("post", approvalsPath(world.organizationA), {
      action: APPROVAL_ACTION.DISCOUNT,
      subjectKey: "quote:manager",
      locationId: world.locationA1,
      approverMemberId: manager.memberId,
      pin: "4321",
    });
    expect(managerSelf.status).toBe(400);
    expect(managerSelf.body.error.code).toBe(ERROR_CODE.APPROVAL_INVALID);
  });

  it("refuses OWNER self-approval when the setting is off", async () => {
    const world = await aWorld();
    const patched = await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [{ settingKey: IAM_OWNER_SELF_APPROVAL_SETTING_KEY, value: false }],
    });
    expect(patched.status).toBe(200);
    await world.alice.call("put", pinPath(world.organizationA), {
      currentPassword: API_PASSWORD,
      pin: "1111",
    });
    const aliceMember = await harness.connections.platform
      .collection("members")
      .findOne({ organizationId: world.organizationA, userId: world.alice.userId });
    const response = await world.alice.call("post", approvalsPath(world.organizationA), {
      action: APPROVAL_ACTION.DISCOUNT,
      subjectKey: "quote:owner-off",
      locationId: world.locationA1,
      approverMemberId: aliceMember?.["memberId"],
      pin: "1111",
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODE.APPROVAL_INVALID);
  });

  it("answers 429 when one address exceeds the per-IP approval rate limit", async () => {
    const world = await aWorld();
    const manager = await managerWithPin(world);
    const ip = freshIp();
    const limit = APPROVAL_RATE_LIMIT.PER_IP.limit;
    for (let attempt = 0; attempt < limit; attempt += 1) {
      const ok = await world.sam.callWith({
        method: "post",
        path: approvalsPath(world.organizationA),
        ip,
        body: {
          action: APPROVAL_ACTION.REFUND,
          subjectKey: `order:rate-${String(attempt)}`,
          locationId: world.locationA1,
          approverMemberId: manager.memberId,
          pin: "4321",
        },
      });
      expect(ok.status).toBe(200);
    }
    const limited = await world.sam.callWith({
      method: "post",
      path: approvalsPath(world.organizationA),
      ip,
      body: {
        action: APPROVAL_ACTION.REFUND,
        subjectKey: "order:rate-over",
        locationId: world.locationA1,
        approverMemberId: manager.memberId,
        pin: "4321",
      },
    });
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe(ERROR_CODE.RATE_LIMITED);
  });
});

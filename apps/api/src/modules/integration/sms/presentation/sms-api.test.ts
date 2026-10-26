import { ALL_LOCATIONS, PLATFORM_ROLE, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { SMS_FAILURE_REASON, SMS_OUTCOME, SMS_PURPOSE, SMS_SOURCE } from "@banijjik/contracts/sms";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startSmsStub, type SmsStubRequest } from "../../../../test-support/sms-http-stub.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import {
  createOrganizationAs,
  newActor,
} from "../../../../test-support/organization-tenant-world.js";
import {
  createPlatformActor,
  type PlatformActor,
} from "../../../../test-support/platform-world.js";
import type { ApiActor } from "../../../../test-support/two-organizations.js";
import { addManagerMember } from "../../../../test-support/organization-api-scenarios.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";

registerIamApiModels();

let harness: IamApiHarness;
let owner: ApiActor;
let support: PlatformActor;
let superAdmin: PlatformActor;
let organizationId: string;
let smsStub: Awaited<ReturnType<typeof startSmsStub>>;
let providerCode = 1506;

function providerReply(request: SmsStubRequest): { body: object } {
  if (request.url === "/auth/tokens") return { body: { token: "test-token" } };
  if (request.url === "/smsapi") return { body: { response_code: providerCode } };
  return { body: { errorCode: providerCode, status: providerCode === 0 ? "SUCCESS" : "FAILED" } };
}

beforeAll(async () => {
  smsStub = await startSmsStub(providerReply);
  harness = await startIamApi({
    environmentOverrides: {
      SMS_ADAREACH_BASE_URL: smsStub.baseUrl,
      SMS_BULKSMSBD_BASE_URL: smsStub.baseUrl,
    },
  });
  owner = await newActor(harness.app);
  ({ organizationId } = await createOrganizationAs(owner, harness.connections, {
    industryTemplateKey: "RETAIL",
  }));
  support = await createPlatformActor(harness.app, harness.connections, [PLATFORM_ROLE.SUPPORT]);
  superAdmin = await createPlatformActor(harness.app, harness.connections, [
    PLATFORM_ROLE.SUPER_ADMIN,
  ]);
});

afterAll(async () => {
  await harness.dispose();
  await smsStub.close();
});

describe("tenant SMS gateway API", () => {
  it("saves an adaReach credential, returns only hasPassword, and audits changed names", async () => {
    const saved = await owner.call("put", `/orgs/${organizationId}/sms/gateway`, {
      version: 0,
      enabled: true,
      activeProvider: "ADAREACH",
      adareach: { username: "account", password: "private-password", senderId: "MASK" },
    });
    const read = await owner.call("get", `/orgs/${organizationId}/sms/gateway`);
    const audits = await harness.connections.tenantShared
      .collection("audit_logs")
      .find({ organizationId, entityType: "smsGatewaySetting" })
      .toArray();

    const errorLines = harness.logs
      .lines()
      .filter((line) => line["requestId"] === saved.body.error?.requestId);
    expect(saved.status, JSON.stringify({ body: saved.body, logs: errorLines })).toBe(200);
    expect(read.body.data.adareach).toEqual({
      username: "account",
      senderId: "MASK",
      hasPassword: true,
    });
    expect(JSON.stringify(read.body)).not.toContain("private-password");
    expect(harness.logs.text()).not.toContain("private-password");
    expect(audits[0]?.["changes"]).toMatchObject({
      fields: { to: expect.arrayContaining(["adareach.password"]) },
    });
    expect(JSON.stringify(audits)).not.toContain("private-password");

    const kept = await owner.call("put", `/orgs/${organizationId}/sms/gateway`, {
      version: 1,
      enabled: true,
      activeProvider: "ADAREACH",
      adareach: { username: "account", senderId: "MASK" },
    });
    expect(kept.status).toBe(200);
    expect(kept.body.data.adareach.hasPassword).toBe(true);
  });

  it("refuses a stale version and an incomplete enabled gateway", async () => {
    const incomplete = await owner.call("put", `/orgs/${organizationId}/sms/gateway`, {
      version: 2,
      enabled: true,
      activeProvider: "BULKSMSBD",
      bulksmsbd: { senderId: "MASK" },
    });
    const stale = await owner.call("put", `/orgs/${organizationId}/sms/gateway`, {
      version: 0,
      enabled: true,
      activeProvider: "ADAREACH",
      adareach: { username: "account", senderId: "MASK" },
    });

    expect(incomplete.status).toBe(422);
    expect(incomplete.body.error.details.ruleKey).toBe("SMS_GATEWAY_INCOMPLETE");
    expect(stale.status).toBe(409);
  });

  it("returns BALANCE_LOW for provider refusals and rate limits the sixth test SMS", async () => {
    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () =>
        owner.call("post", `/orgs/${organizationId}/sms/gateway/test`, {
          phoneE164: "+8801712345678",
        }),
      ),
    );
    const sixth = await owner.call("post", `/orgs/${organizationId}/sms/gateway/test`, {
      phoneE164: "+8801712345678",
    });
    expect(outcomes.map((response) => response.body.data.failureReason)).toEqual(
      Array(5).fill("BALANCE_LOW"),
    );
    expect(outcomes.every((response) => response.status === 200)).toBe(true);
    expect(sixth.status).toBe(429);
    expect(sixth.body.error.details.ruleKey).toBe("SMS_TEST_LIMIT");
  });

  it("paginates logs and filters by outcome", async () => {
    const now = new Date();
    await harness.connections.tenantShared.collection("sms_logs").insertMany(
      [0, 1].map((index) => ({
        smsLogId: newId(),
        organizationId,
        purpose: SMS_PURPOSE.CUSTOMER_OTP,
        phoneLastDigits: "678",
        source: SMS_SOURCE.NONE,
        provider: null,
        outcome: SMS_OUTCOME.REFUSED,
        failureReason: SMS_FAILURE_REASON.PROVIDER_REFUSED,
        providerErrorCode: null,
        parts: null,
        providerMessageId: null,
        businessDate: "2026-10-26",
        createdAt: new Date(now.getTime() + index),
        updatedAt: now,
        version: 1,
        createdByUserId: owner.userId,
        updatedByUserId: owner.userId,
      })),
    );
    const first = await owner.call(
      "get",
      `/orgs/${organizationId}/sms/logs?outcome=REFUSED&limit=1`,
    );
    expect(first.status).toBe(200);
    expect(first.body.data.items).toHaveLength(1);
    expect(first.body.data.items[0].outcome).toBe("REFUSED");
    expect(first.body.data.nextCursor).toBeTruthy();
    let cursor = first.body.data.nextCursor as string | null;
    let pages = 1;
    while (cursor !== null && pages < 20) {
      const next = await owner.call(
        "get",
        `/orgs/${organizationId}/sms/logs?outcome=REFUSED&limit=1&cursor=${cursor}`,
      );
      expect(next.status).toBe(200);
      expect(next.body.data.items).toHaveLength(1);
      expect(next.body.data.items[0].outcome).toBe("REFUSED");
      cursor = next.body.data.nextCursor as string | null;
      pages += 1;
    }
    expect(pages).toBeGreaterThan(2);
    expect(cursor).toBeNull();
  });

  it("keeps each organization's gateway separate and denies credential updates to a manager", async () => {
    const secondOwner = await newActor(harness.app);
    const second = await createOrganizationAs(secondOwner, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    const secondRead = await secondOwner.call("get", `/orgs/${second.organizationId}/sms/gateway`);
    const manager = await newActor(harness.app);
    await addManagerMember(harness.connections, { organizationId, userId: manager.userId });
    const cashierRoleId = await findSystemRoleId(
      harness.connections,
      organizationId,
      SYSTEM_ROLE_KEY.CASHIER,
    );
    const { actor: cashier } = await addMemberWithAssignments(harness.app, organizationId, [
      { locationId: ALL_LOCATIONS, roleId: cashierRoleId },
    ]);
    expect(secondRead.body.data).toMatchObject({ enabled: false, activeProvider: null });
    expect((await owner.call("get", `/orgs/${second.organizationId}/sms/gateway`)).status).toBe(
      404,
    );
    expect((await manager.call("get", `/orgs/${organizationId}/sms/gateway`)).status).toBe(200);
    expect((await cashier.call("get", `/orgs/${organizationId}/sms/gateway`)).status).toBe(403);
    expect(
      (
        await manager.call("put", `/orgs/${organizationId}/sms/gateway`, {
          version: 1,
          enabled: false,
          activeProvider: "ADAREACH",
        })
      ).status,
    ).toBe(403);
  });
});

describe("platform SMS gateway API", () => {
  it("allows support to read without writing and super admins to save without exposing secrets", async () => {
    const forbidden = await support.call("put", "/sms-gateway", {
      version: 0,
      enabled: true,
      activeProvider: "BULKSMSBD",
      bulksmsbd: { senderId: "MASK", apiKey: "platform-secret" },
    });
    const saved = await superAdmin.call("put", "/sms-gateway", {
      version: 0,
      enabled: true,
      activeProvider: "BULKSMSBD",
      bulksmsbd: { senderId: "MASK", apiKey: "platform-secret" },
    });
    const read = await support.call("get", "/sms-gateway");

    expect(forbidden.status).toBe(403);
    expect(saved.status).toBe(200);
    expect(read.body.data.bulksmsbd).toEqual({ senderId: "MASK", hasApiKey: true });
    expect(JSON.stringify(read.body)).not.toContain("platform-secret");
  });

  it("answers a platform test send without adding a tenant SMS log", async () => {
    const saved = await superAdmin.call("put", "/sms-gateway", {
      version: 1,
      enabled: true,
      activeProvider: "BULKSMSBD",
      bulksmsbd: { senderId: "MASK", apiKey: "platform-key" },
    });
    providerCode = 202;
    const before = await harness.connections.tenantShared.collection("sms_logs").countDocuments({});
    const response = await superAdmin.call("post", "/sms-gateway/test", {
      phoneE164: "+8801712345678",
    });
    const after = await harness.connections.tenantShared.collection("sms_logs").countDocuments({});
    expect(saved.status).toBe(200);
    expect(response.body.data).toMatchObject({ source: "PLATFORM", outcome: "SENT" });
    expect(after).toBe(before);
  });
});

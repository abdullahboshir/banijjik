import { ALL_LOCATIONS, AUDIT_ACTION, ERROR_CODE, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import {
  CREDIT_EVENT_TYPE,
  CREDIT_PURCHASE_METHOD,
  CREDIT_PURCHASE_STATUS,
  CREDIT_RULE_KEY,
  type CreditPack,
  type CreditPurchaseResponse,
} from "@banijjik/contracts/credit";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { newId } from "@banijjik/ids";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_PASSWORD } from "../../../../test-support/auth-api-scenarios.js";
import {
  disableCreditModule,
  enableCreditForWorld,
  ownerOf,
} from "../../../../test-support/credit-world.js";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { ContractTemplateReader } from "../../../../test-support/module-contract/contract-template-reader.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import {
  asCustomerCookies,
  callStorefront,
  enableCustomerLogin,
  signInCustomer,
} from "../../../../test-support/storefront-world.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";
import { MongoUnitOfWork } from "../../../../kernel/db/index.js";
import { runInOrganizationContext } from "../../../../kernel/tenancy/index.js";
import { MongoCreditPurchaseRepository, CancelExpiredPurchasesUseCase } from "../index.js";

registerIamApiModels();

const templateReader = new ContractTemplateReader();
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi({ templateReader, tenantRouters: [] });
});

afterAll(async () => {
  await harness.dispose();
});

function packsPath(organizationId: string): string {
  return `/orgs/${organizationId}/credit/packs`;
}

function staffPurchasesPath(organizationId: string): string {
  return `/orgs/${organizationId}/credit/purchases`;
}

function packBody(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    name: { bn: "১০ ক্রেডিট", en: "10 Credits" },
    credits: 10,
    price: { amount: 500, currency: "BDT" },
    validityDays: 30,
    sortOrder: 1,
    ...overrides,
  };
}

function patchSettings(
  world: TwoOrganizations,
  organizationId: string,
  items: readonly { readonly settingKey: string; readonly value: unknown }[],
) {
  return ownerOf(world, organizationId).call("patch", `/orgs/${organizationId}/settings`, {
    items,
  });
}

function dataOf<T>(response: Response): T {
  return response.body.data as T;
}

const DEFAULT_METHODS_SETTING = [
  {
    method: CREDIT_PURCHASE_METHOD.BKASH,
    accountNumber: "01700000001",
    accountType: "Merchant",
    instructions: { bn: "বিকাশ পেমেন্ট করুন", en: "Pay via bKash" },
  },
  {
    method: CREDIT_PURCHASE_METHOD.NAGAD,
    accountNumber: "01800000001",
    accountType: "Merchant",
    instructions: { bn: "নগদ পেমেন্ট করুন", en: "Pay via Nagad" },
  },
];

describe("credit purchase API", () => {
  it("happy path: submit -> staff verify -> credits granted once, ledger entry and events recorded", async () => {
    const world = await createTwoOrganizations(harness.app, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    await enableCreditForWorld(world);
    await enableCustomerLogin(world, world.organizationA);

    const organizationId = world.organizationA;

    // Configure payment methods
    await patchSettings(world, organizationId, [
      { settingKey: CREDIT_RULE_KEY.PAYMENT_METHODS, value: DEFAULT_METHODS_SETTING },
    ]);

    // Create a credit pack
    const createdPack = await world.alice.call("post", packsPath(organizationId), packBody());
    expect(createdPack.status).toBe(201);
    const pack = dataOf<CreditPack>(createdPack);

    // Customer signs in
    const customer = await signInCustomer(harness, organizationId, "01711111111");

    // Check payment info endpoint
    const paymentInfoRes = await callStorefront(harness.app, {
      organizationId,
      suffix: "/credit/payment-info",
      method: "get",
      cookies: asCustomerCookies(customer.session),
    });
    expect(paymentInfoRes.status).toBe(200);
    expect(paymentInfoRes.body.data.methods).toHaveLength(2);

    // Customer submits purchase
    const submitRes = await callStorefront(harness.app, {
      organizationId,
      suffix: "/credit-purchases",
      method: "post",
      idempotencyKey: newId(),
      body: {
        creditPackId: pack.creditPackId,
        method: CREDIT_PURCHASE_METHOD.BKASH,
        senderPhone: "+8801711111111",
        transactionReference: "trxhappy01",
      },
      cookies: asCustomerCookies(customer.session),
    });
    expect(submitRes.status, JSON.stringify(submitRes.body)).toBe(201);
    const purchase = dataOf<CreditPurchaseResponse>(submitRes);
    expect(purchase.status).toBe(CREDIT_PURCHASE_STATUS.PENDING);
    expect(purchase.purchaseNumber).toMatch(/^CP-\d+$/);
    expect(purchase.transactionReference).toBe("TRXHAPPY01");
    expect(purchase.snapshot.credits).toBe(10);
    expect(purchase.snapshot.price.amount).toBe(500);

    // Customer lists their purchases
    const myPurchasesRes = await callStorefront(harness.app, {
      organizationId,
      suffix: "/my/credit-purchases",
      method: "get",
      cookies: asCustomerCookies(customer.session),
    });
    expect(myPurchasesRes.status).toBe(200);
    expect(myPurchasesRes.body.data.items).toHaveLength(1);
    expect(myPurchasesRes.body.data.items[0].creditPurchaseId).toBe(purchase.creditPurchaseId);

    // Staff lists purchases
    const staffListRes = await world.alice.call("get", staffPurchasesPath(organizationId));
    expect(staffListRes.status).toBe(200);
    expect(staffListRes.body.data.items).toHaveLength(1);

    // Staff verifies purchase
    const verifyRes = await world.alice.call(
      "post",
      `${staffPurchasesPath(organizationId)}/${purchase.creditPurchaseId}/verify`,
      { version: 1 },
    );
    expect(verifyRes.status).toBe(200);
    const verified = dataOf<CreditPurchaseResponse>(verifyRes);
    expect(verified.status).toBe(CREDIT_PURCHASE_STATUS.VERIFIED);
    expect(verified.creditEntryId).toBeTruthy();
    expect(verified.verifiedByUserId).toBeTruthy();

    // Verify balance went up
    const myCreditsRes = await callStorefront(harness.app, {
      organizationId,
      suffix: "/my/credits",
      method: "get",
      cookies: asCustomerCookies(customer.session),
    });
    expect(myCreditsRes.status).toBe(200);
    expect(myCreditsRes.body.data.balance).toBe(10);

    // Verify outbox events
    const outboxEvents = await harness.connections.platform
      .collection("outbox_events")
      .find({ organizationId })
      .toArray();
    const eventTypes = outboxEvents.map((e) => e["type"]);
    expect(eventTypes).toContain(CREDIT_EVENT_TYPE.PURCHASE_SUBMITTED);
    expect(eventTypes).toContain(CREDIT_EVENT_TYPE.PURCHASE_VERIFIED);
    expect(eventTypes).toContain(CREDIT_EVENT_TYPE.CREDIT_ENTRY_CREATED);

    // Verify audit logs
    const auditLogs = await harness.connections.tenantShared
      .collection("audit_logs")
      .find({ organizationId, entityId: purchase.creditPurchaseId })
      .toArray();
    const auditActions = auditLogs.map((a) => a["action"]);
    expect(auditActions).toContain(AUDIT_ACTION.CREDIT_PURCHASE_SUBMITTED);
    expect(auditActions).toContain(AUDIT_ACTION.CREDIT_PURCHASE_VERIFIED);
  });

  it("duplicate reference: rejected if PENDING or VERIFIED, allowed after REJECTED, and parallel race test", async () => {
    const world = await createTwoOrganizations(harness.app, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    await enableCreditForWorld(world);
    await enableCustomerLogin(world, world.organizationA);
    const organizationId = world.organizationA;

    await patchSettings(world, organizationId, [
      { settingKey: CREDIT_RULE_KEY.PAYMENT_METHODS, value: DEFAULT_METHODS_SETTING },
    ]);

    const createdPack = await world.alice.call("post", packsPath(organizationId), packBody());
    const pack = dataOf<CreditPack>(createdPack);
    const customer = await signInCustomer(harness, organizationId, "01722222222");

    // First submission
    const res1 = await callStorefront(harness.app, {
      organizationId,
      suffix: "/credit-purchases",
      method: "post",
      idempotencyKey: newId(),
      body: {
        creditPackId: pack.creditPackId,
        method: CREDIT_PURCHASE_METHOD.BKASH,
        senderPhone: "+8801722222222",
        transactionReference: "TRXDUPLICATE1",
      },
      cookies: asCustomerCookies(customer.session),
    });
    expect(res1.status).toBe(201);

    // Second submission with same method + reference -> 409
    const res2 = await callStorefront(harness.app, {
      organizationId,
      suffix: "/credit-purchases",
      method: "post",
      idempotencyKey: newId(),
      body: {
        creditPackId: pack.creditPackId,
        method: CREDIT_PURCHASE_METHOD.BKASH,
        senderPhone: "+8801722222222",
        transactionReference: "TRXDUPLICATE1",
      },
      cookies: asCustomerCookies(customer.session),
    });
    expect(res2.status).toBe(409);
    expect(res2.body.error.code).toBe(ERROR_CODE.CONFLICT);

    // Staff rejects the first purchase
    const purchaseId = dataOf<CreditPurchaseResponse>(res1).creditPurchaseId;
    const rejectRes = await world.alice.call(
      "post",
      `${staffPurchasesPath(organizationId)}/${purchaseId}/reject`,
      { version: 1, reason: "Invalid screenshot / mismatched amount" },
    );
    expect(rejectRes.status).toBe(200);
    expect(dataOf<CreditPurchaseResponse>(rejectRes).status).toBe(CREDIT_PURCHASE_STATUS.REJECTED);

    // After REJECTED, same reference can be submitted again!
    const res3 = await callStorefront(harness.app, {
      organizationId,
      suffix: "/credit-purchases",
      method: "post",
      idempotencyKey: newId(),
      body: {
        creditPackId: pack.creditPackId,
        method: CREDIT_PURCHASE_METHOD.BKASH,
        senderPhone: "+8801722222222",
        transactionReference: "TRXDUPLICATE1",
      },
      cookies: asCustomerCookies(customer.session),
    });
    expect(res3.status).toBe(201);

    // Parallel submissions with same reference -> exactly one 201, one 409
    const [p1, p2] = await Promise.all([
      callStorefront(harness.app, {
        organizationId,
        suffix: "/credit-purchases",
        method: "post",
        idempotencyKey: newId(),
        body: {
          creditPackId: pack.creditPackId,
          method: CREDIT_PURCHASE_METHOD.NAGAD,
          senderPhone: "+8801722222222",
          transactionReference: "TRXPARALLEL99",
        },
        cookies: asCustomerCookies(customer.session),
      }),
      callStorefront(harness.app, {
        organizationId,
        suffix: "/credit-purchases",
        method: "post",
        idempotencyKey: newId(),
        body: {
          creditPackId: pack.creditPackId,
          method: CREDIT_PURCHASE_METHOD.NAGAD,
          senderPhone: "+8801722222222",
          transactionReference: "TRXPARALLEL99",
        },
        cookies: asCustomerCookies(customer.session),
      }),
    ]);
    const statuses = [p1.status, p2.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  it("idempotent verify: verify twice returns identical response, parallel verify grants once", async () => {
    const world = await createTwoOrganizations(harness.app, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    await enableCreditForWorld(world);
    await enableCustomerLogin(world, world.organizationA);
    const organizationId = world.organizationA;

    await patchSettings(world, organizationId, [
      { settingKey: CREDIT_RULE_KEY.PAYMENT_METHODS, value: DEFAULT_METHODS_SETTING },
    ]);

    const createdPack = await world.alice.call("post", packsPath(organizationId), packBody());
    const pack = dataOf<CreditPack>(createdPack);
    const customer = await signInCustomer(harness, organizationId, "01733333333");

    const submitRes = await callStorefront(harness.app, {
      organizationId,
      suffix: "/credit-purchases",
      method: "post",
      idempotencyKey: newId(),
      body: {
        creditPackId: pack.creditPackId,
        method: CREDIT_PURCHASE_METHOD.BKASH,
        senderPhone: "+8801733333333",
        transactionReference: "TRXIDEMPOTENT1",
      },
      cookies: asCustomerCookies(customer.session),
    });
    const purchase = dataOf<CreditPurchaseResponse>(submitRes);

    // First verify
    const verify1 = await world.alice.call(
      "post",
      `${staffPurchasesPath(organizationId)}/${purchase.creditPurchaseId}/verify`,
      { version: 1 },
    );
    expect(verify1.status).toBe(200);

    // Second verify -> idempotent 200
    const verify2 = await world.alice.call(
      "post",
      `${staffPurchasesPath(organizationId)}/${purchase.creditPurchaseId}/verify`,
      { version: 2 },
    );
    expect(verify2.status).toBe(200);
    expect(dataOf<CreditPurchaseResponse>(verify2).creditEntryId).toBe(
      dataOf<CreditPurchaseResponse>(verify1).creditEntryId,
    );

    // Balance check: only 10 credits granted!
    const myCreditsRes = await callStorefront(harness.app, {
      organizationId,
      suffix: "/my/credits",
      method: "get",
      cookies: asCustomerCookies(customer.session),
    });
    expect(myCreditsRes.body.data.balance).toBe(10);
  });

  it("limits and rules: maxPending, rate-limiting, pack snapshot, unconfigured method, and customer cancel", async () => {
    const world = await createTwoOrganizations(harness.app, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    await enableCreditForWorld(world);
    await enableCustomerLogin(world, world.organizationA);
    const organizationId = world.organizationA;

    // Set maxPending = 2
    await patchSettings(world, organizationId, [
      { settingKey: CREDIT_RULE_KEY.PAYMENT_METHODS, value: DEFAULT_METHODS_SETTING },
      { settingKey: CREDIT_RULE_KEY.PURCHASE_MAX_PENDING, value: 2 },
    ]);

    const createdPack = await world.alice.call("post", packsPath(organizationId), packBody());
    const pack = dataOf<CreditPack>(createdPack);
    const customer = await signInCustomer(harness, organizationId, "01744444444");

    // Submit 1
    const sub1 = await callStorefront(harness.app, {
      organizationId,
      suffix: "/credit-purchases",
      method: "post",
      idempotencyKey: newId(),
      body: {
        creditPackId: pack.creditPackId,
        method: CREDIT_PURCHASE_METHOD.BKASH,
        senderPhone: "+8801744444444",
        transactionReference: "TRXLIMIT01",
      },
      cookies: asCustomerCookies(customer.session),
    });
    expect(sub1.status).toBe(201);

    // Submit 2
    const sub2 = await callStorefront(harness.app, {
      organizationId,
      suffix: "/credit-purchases",
      method: "post",
      idempotencyKey: newId(),
      body: {
        creditPackId: pack.creditPackId,
        method: CREDIT_PURCHASE_METHOD.BKASH,
        senderPhone: "+8801744444444",
        transactionReference: "TRXLIMIT02",
      },
      cookies: asCustomerCookies(customer.session),
    });
    expect(sub2.status).toBe(201);

    // Submit 3 -> exceeds maxPending (2) -> 422
    const sub3 = await callStorefront(harness.app, {
      organizationId,
      suffix: "/credit-purchases",
      method: "post",
      idempotencyKey: newId(),
      body: {
        creditPackId: pack.creditPackId,
        method: CREDIT_PURCHASE_METHOD.BKASH,
        senderPhone: "+8801744444444",
        transactionReference: "TRXLIMIT03",
      },
      cookies: asCustomerCookies(customer.session),
    });
    expect(sub3.status).toBe(422);
    expect(sub3.body.error.code).toBe(ERROR_CODE.LIMIT_REACHED);

    // Customer cancels purchase 1
    const p1Id = dataOf<CreditPurchaseResponse>(sub1).creditPurchaseId;
    const cancelRes = await callStorefront(harness.app, {
      organizationId,
      suffix: `/credit-purchases/${p1Id}/cancel`,
      method: "post",
      cookies: asCustomerCookies(customer.session),
    });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe(CREDIT_PURCHASE_STATUS.CANCELLED);

    // Staff cannot verify a cancelled purchase
    const verifyCancelled = await world.alice.call(
      "post",
      `${staffPurchasesPath(organizationId)}/${p1Id}/verify`,
      { version: 2 },
    );
    expect(verifyCancelled.status).toBe(409);

    // Now only 1 pending purchase -> submission 3 can proceed!
    const sub3Retry = await callStorefront(harness.app, {
      organizationId,
      suffix: "/credit-purchases",
      method: "post",
      idempotencyKey: newId(),
      body: {
        creditPackId: pack.creditPackId,
        method: CREDIT_PURCHASE_METHOD.BKASH,
        senderPhone: "+8801744444444",
        transactionReference: "TRXLIMIT03",
      },
      cookies: asCustomerCookies(customer.session),
    });
    expect(sub3Retry.status).toBe(201);

    // Archive pack and attempt submission -> 422
    await world.alice.call("post", `${packsPath(organizationId)}/${pack.creditPackId}/archive`, {
      version: 1,
    });
    const subArchived = await callStorefront(harness.app, {
      organizationId,
      suffix: "/credit-purchases",
      method: "post",
      idempotencyKey: newId(),
      body: {
        creditPackId: pack.creditPackId,
        method: CREDIT_PURCHASE_METHOD.BKASH,
        senderPhone: "+8801744444444",
        transactionReference: "TRXARCHIVED",
      },
      cookies: asCustomerCookies(customer.session),
    });
    expect(subArchived.status).toBe(422);
  });

  it("staff rules: self-service guard (403), approval token required above threshold, and permissions", async () => {
    const world = await createTwoOrganizations(harness.app, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    await enableCreditForWorld(world);
    await enableCustomerLogin(world, world.organizationA);
    const organizationId = world.organizationA;

    // Payment methods and approval threshold: 400 BDT (so 500 BDT pack requires approval)
    await patchSettings(world, organizationId, [
      { settingKey: CREDIT_RULE_KEY.PAYMENT_METHODS, value: DEFAULT_METHODS_SETTING },
      { settingKey: CREDIT_RULE_KEY.PURCHASE_APPROVAL_ABOVE, value: 400 },
    ]);

    const createdPack = await world.alice.call("post", packsPath(organizationId), packBody());
    const pack = dataOf<CreditPack>(createdPack);

    // Add staff member in Org A
    const staffRoleId = await findSystemRoleId(
      harness.connections,
      organizationId,
      SYSTEM_ROLE_KEY.STAFF,
    );
    const staff = await addMemberWithAssignments(harness.app, organizationId, [
      { locationId: ALL_LOCATIONS, roleId: staffRoleId },
    ]);

    // Add Manager / Approver in Org A
    const managerRoleId = await findSystemRoleId(
      harness.connections,
      organizationId,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const manager = await addMemberWithAssignments(harness.app, organizationId, [
      { locationId: world.locationA1, roleId: managerRoleId },
    ]);
    const pinRes = await manager.actor.call("put", `/orgs/${organizationId}/me/approval-pin`, {
      currentPassword: API_PASSWORD,
      pin: "4321",
    });
    expect(pinRes.status).toBe(204);

    // Customer submits purchase
    const customer = await signInCustomer(harness, organizationId, "01777777777");
    const subRes = await callStorefront(harness.app, {
      organizationId,
      suffix: "/credit-purchases",
      method: "post",
      idempotencyKey: newId(),
      body: {
        creditPackId: pack.creditPackId,
        method: CREDIT_PURCHASE_METHOD.BKASH,
        senderPhone: "+8801777777777",
        transactionReference: "TRXAPPROVAL01",
      },
      cookies: asCustomerCookies(customer.session),
    });
    const purchase = dataOf<CreditPurchaseResponse>(subRes);

    // Staff tries to verify without approval token -> 403 APPROVAL_REQUIRED
    const verifyWithoutToken = await staff.actor.call(
      "post",
      `${staffPurchasesPath(organizationId)}/${purchase.creditPurchaseId}/verify`,
      { version: 1 },
    );
    expect(verifyWithoutToken.status).toBe(403);
    expect(verifyWithoutToken.body.error.code).toBe(ERROR_CODE.APPROVAL_REQUIRED);

    // Create approval token for CREDIT_PURCHASE_VERIFY
    const approvalRes = await staff.actor.call("post", `/orgs/${organizationId}/approvals`, {
      action: APPROVAL_ACTION.CREDIT_PURCHASE_VERIFY,
      subjectKey: purchase.creditPurchaseId,
      amount: { amount: 500, currency: "BDT" },
      locationId: world.locationA1,
      approverMemberId: manager.memberId,
      pin: "4321",
    });
    expect(approvalRes.status).toBe(200);
    const approvalToken = approvalRes.body.data.approvalToken as string;

    // Staff verifies with approval token -> succeeds!
    const verifyWithToken = await staff.actor.call(
      "post",
      `${staffPurchasesPath(organizationId)}/${purchase.creditPurchaseId}/verify`,
      { version: 1, approvalToken },
    );
    expect(verifyWithToken.status).toBe(200);

    // Self-service guard test:
    // Create purchase for a customer whose phone matches staff's phone
    await harness.connections.platform
      .collection("users")
      .updateOne({ userId: staff.actor.userId }, { $set: { phoneE164: "+8801755555555" } });
    const staffAsCustomer = await signInCustomer(harness, organizationId, "01755555555");
    const staffSub = await callStorefront(harness.app, {
      organizationId,
      suffix: "/credit-purchases",
      method: "post",
      idempotencyKey: newId(),
      body: {
        creditPackId: pack.creditPackId,
        method: CREDIT_PURCHASE_METHOD.BKASH,
        senderPhone: "+8801755555555",
        transactionReference: "TRXSELFSERVICE",
      },
      cookies: asCustomerCookies(staffAsCustomer.session),
    });
    const staffPurchase = dataOf<CreditPurchaseResponse>(staffSub);

    // Staff tries to verify own purchase -> 403 CreditSelfVerifyForbiddenError
    const selfVerify = await staff.actor.call(
      "post",
      `${staffPurchasesPath(organizationId)}/${staffPurchase.creditPurchaseId}/verify`,
      { version: 1 },
    );
    expect(selfVerify.status).toBe(403);
    expect(selfVerify.body.error.messageKey).toBe("errors.credit_self_verify_forbidden");

    // Cross-org check: Org B staff cannot access Org A purchase
    const crossOrgGet = await world.bob.call(
      "get",
      `${staffPurchasesPath(world.organizationB)}/${purchase.creditPurchaseId}`,
    );
    expect(crossOrgGet.status).toBe(404);
  });

  it("expiry job: cancels expired pending purchases cleanly and idempotently", async () => {
    const world = await createTwoOrganizations(harness.app, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    await enableCreditForWorld(world);
    await enableCustomerLogin(world, world.organizationA);
    const organizationId = world.organizationA;

    await patchSettings(world, organizationId, [
      { settingKey: CREDIT_RULE_KEY.PAYMENT_METHODS, value: DEFAULT_METHODS_SETTING },
      { settingKey: CREDIT_RULE_KEY.PURCHASE_PENDING_DAYS, value: 1 },
    ]);

    const createdPack = await world.alice.call("post", packsPath(organizationId), packBody());
    const pack = dataOf<CreditPack>(createdPack);
    const customer = await signInCustomer(harness, organizationId, "01788888888");

    const subRes = await callStorefront(harness.app, {
      organizationId,
      suffix: "/credit-purchases",
      method: "post",
      idempotencyKey: newId(),
      body: {
        creditPackId: pack.creditPackId,
        method: CREDIT_PURCHASE_METHOD.BKASH,
        senderPhone: "+8801788888888",
        transactionReference: "TRXEXPIRY01",
      },
      cookies: asCustomerCookies(customer.session),
    });
    const purchase = dataOf<CreditPurchaseResponse>(subRes);

    const purchasesRepo = new MongoCreditPurchaseRepository();
    const unitOfWork = new MongoUnitOfWork();
    const expiryUseCase = new CancelExpiredPurchasesUseCase({
      purchases: purchasesRepo,
      unitOfWork,
      audit: { record: async () => {} },
      events: { publish: async () => {} },
    } as unknown as import("../application/ports/credit-dependencies.js").CreditDependencies);

    await runInOrganizationContext(organizationId, async () => {
      // Run expiry now (not yet expired) -> 0 cancelled
      const cancelledNow = await expiryUseCase.execute(new Date());
      expect(cancelledNow).toBe(0);

      // Run expiry 2 days in future -> 1 cancelled
      const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const cancelledFuture = await expiryUseCase.execute(futureDate);
      expect(cancelledFuture).toBe(1);

      // Run again -> 0 cancelled (idempotent)
      const cancelledAgain = await expiryUseCase.execute(futureDate);
      expect(cancelledAgain).toBe(0);
    });

    // Purchase is now CANCELLED in DB
    const refreshed = await world.alice.call(
      "get",
      `${staffPurchasesPath(organizationId)}/${purchase.creditPurchaseId}`,
    );
    expect(refreshed.status).toBe(200);
    expect(dataOf<CreditPurchaseResponse>(refreshed).status).toBe(CREDIT_PURCHASE_STATUS.CANCELLED);
  });

  it("module off: storefront and staff purchase routes are not available when credit module is disabled", async () => {
    const world = await createTwoOrganizations(harness.app, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    await enableCreditForWorld(world);
    await enableCustomerLogin(world, world.organizationA);
    const organizationId = world.organizationA;

    const customer = await signInCustomer(harness, organizationId, "01799999999");

    // Disable credit module
    await disableCreditModule(organizationId);

    // Storefront routes absent
    const sfRes = await callStorefront(harness.app, {
      organizationId,
      suffix: "/credit/payment-info",
      method: "get",
      cookies: asCustomerCookies(customer.session),
    });
    expect(sfRes.status).toBe(404);

    const sfPurchasesRes = await callStorefront(harness.app, {
      organizationId,
      suffix: "/my/credit-purchases",
      method: "get",
      cookies: asCustomerCookies(customer.session),
    });
    expect(sfPurchasesRes.status).toBe(404);

    // Staff routes absent / forbidden
    const staffRes = await world.alice.call("get", staffPurchasesPath(organizationId));
    expect(staffRes.status).toBe(403);
    expect(staffRes.body.error.code).toBe(ERROR_CODE.MODULE_DISABLED);
  });
});

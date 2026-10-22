import { ALL_LOCATIONS, ERROR_CODE, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import {
  CREDIT_PURCHASE_METHOD,
  CREDIT_PURCHASE_STATUS,
  CREDIT_RULE_KEY,
  type CreditPack,
  type CreditPurchaseMethod,
  type CreditPurchaseResponse,
} from "@banijjik/contracts/credit";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { newId } from "@banijjik/ids";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_PASSWORD } from "../../../../test-support/auth-api-scenarios.js";
import { enableCreditForWorld, ownerOf } from "../../../../test-support/credit-world.js";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { ContractTemplateReader } from "../../../../test-support/module-contract/contract-template-reader.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import {
  asCustomerCookies,
  callStorefront,
  enableCustomerLogin,
  signInCustomer,
  type SignedInCustomer,
} from "../../../../test-support/storefront-world.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";

registerIamApiModels();

const templateReader = new ContractTemplateReader();
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi({ templateReader, tenantRouters: [] });
});

afterAll(async () => {
  await harness.dispose();
});

const METHODS_SETTING = [
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

const packsPath = (organizationId: string): string => `/orgs/${organizationId}/credit/packs`;
const staffPath = (organizationId: string): string => `/orgs/${organizationId}/credit/purchases`;

function dataOf<T>(response: Response): T {
  return response.body.data as T;
}

interface Shop {
  readonly world: TwoOrganizations;
  readonly organizationId: string;
  readonly pack: CreditPack;
}

/** One organization with credit on, customer login on, payment methods set and one 500 BDT pack. */
async function openShop(settings: readonly { settingKey: string; value: unknown }[] = []) {
  const world = await createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
  await enableCreditForWorld(world);
  await enableCustomerLogin(world, world.organizationA);
  await enableCustomerLogin(world, world.organizationB);
  const organizationId = world.organizationA;
  await ownerOf(world, organizationId).call("patch", `/orgs/${organizationId}/settings`, {
    items: [{ settingKey: CREDIT_RULE_KEY.PAYMENT_METHODS, value: METHODS_SETTING }, ...settings],
  });
  const created = await world.alice.call("post", packsPath(organizationId), {
    name: { bn: "১০ ক্রেডিট", en: "10 Credits" },
    credits: 10,
    price: { amount: 500, currency: "BDT" },
    validityDays: 30,
    sortOrder: 1,
  });
  expect(created.status).toBe(201);
  const shop: Shop = { world, organizationId, pack: dataOf<CreditPack>(created) };
  return shop;
}

function submit(input: {
  readonly shop: Shop;
  readonly customer: SignedInCustomer;
  readonly phone: string;
  readonly reference: string;
  readonly method?: CreditPurchaseMethod;
  readonly creditPackId?: string;
  readonly organizationId?: string;
}): Promise<Response> {
  return callStorefront(harness.app, {
    organizationId: input.organizationId ?? input.shop.organizationId,
    suffix: "/credit-purchases",
    method: "post",
    idempotencyKey: newId(),
    body: {
      creditPackId: input.creditPackId ?? input.shop.pack.creditPackId,
      method: input.method ?? CREDIT_PURCHASE_METHOD.BKASH,
      senderPhone: input.phone,
      transactionReference: input.reference,
    },
    cookies: asCustomerCookies(input.customer.session),
  });
}

async function submitAs(
  shop: Shop,
  localPhone: string,
  reference: string,
): Promise<{ readonly customer: SignedInCustomer; readonly purchase: CreditPurchaseResponse }> {
  const customer = await signInCustomer(harness, shop.organizationId, localPhone);
  const response = await submit({
    shop,
    customer,
    phone: `+88${localPhone}`,
    reference,
  });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return { customer, purchase: dataOf<CreditPurchaseResponse>(response) };
}

function verifyAs(
  actor: Shop["world"]["alice"],
  shop: Shop,
  purchase: CreditPurchaseResponse,
  body: object,
) {
  return actor.call(
    "post",
    `${staffPath(shop.organizationId)}/${purchase.creditPurchaseId}/verify`,
    body,
  );
}

function balanceOf(shop: Shop, customer: SignedInCustomer): Promise<Response> {
  return callStorefront(harness.app, {
    organizationId: shop.organizationId,
    suffix: "/my/credits",
    method: "get",
    cookies: asCustomerCookies(customer.session),
  });
}

describe("credit purchase staff search (R1 item 1)", () => {
  it("treats a catastrophic regex as plain text: 200 with no rows", async () => {
    const shop = await openShop();
    await submitAs(shop, "01711000001", "TRXSEARCH01");

    const response = await shop.world.alice.call(
      "get",
      `${staffPath(shop.organizationId)}?q=${encodeURIComponent("(a+)+$")}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(0);
  });

  it("does not let '.' or '*' widen the search", async () => {
    const shop = await openShop();
    await submitAs(shop, "01711000002", "TRXSEARCH02");

    const response = await shop.world.alice.call(
      "get",
      `${staffPath(shop.organizationId)}?q=${encodeURIComponent("TRX.*")}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(0);
  });

  it("finds a purchase by a reference prefix, in any letter case", async () => {
    const shop = await openShop();
    const { purchase } = await submitAs(shop, "01711000003", "TRXSEARCH03");

    const response = await shop.world.alice.call(
      "get",
      `${staffPath(shop.organizationId)}?q=trxsearch`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.items.map((p: CreditPurchaseResponse) => p.creditPurchaseId)).toEqual(
      [purchase.creditPurchaseId],
    );
  });
});

describe("credit purchase version conflicts (R1 item 3)", () => {
  it("verify with a stale version on a PENDING purchase is the standard 409 conflict", async () => {
    const shop = await openShop();
    const { purchase } = await submitAs(shop, "01712000001", "TRXSTALE001");

    const response = await verifyAs(shop.world.alice, shop, purchase, { version: 99 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe(ERROR_CODE.CONFLICT);
    expect(response.body.error.details.currentVersion).toBe(1);
  });

  it("reject with a stale version on a PENDING purchase is the standard 409 conflict", async () => {
    const shop = await openShop();
    const { purchase } = await submitAs(shop, "01712000002", "TRXSTALE002");

    const response = await shop.world.alice.call(
      "post",
      `${staffPath(shop.organizationId)}/${purchase.creditPurchaseId}/reject`,
      { version: 99, reason: "Wrong amount" },
    );

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe(ERROR_CODE.CONFLICT);
  });
});

describe("credit purchase submit replay (R1 item 4)", () => {
  it("the same submit twice returns two 201s with one purchase and one row", async () => {
    const shop = await openShop();
    const customer = await signInCustomer(harness, shop.organizationId, "01713000001");
    const input = { shop, customer, phone: "+8801713000001", reference: "TRXREPLAY01" };

    const first = await submit(input);
    const second = await submit(input);

    expect([first.status, second.status]).toEqual([201, 201]);
    expect(dataOf<CreditPurchaseResponse>(second)).toEqual(dataOf<CreditPurchaseResponse>(first));
    const list = await shop.world.alice.call("get", staffPath(shop.organizationId));
    expect(list.body.data.items).toHaveLength(1);
  });

  it("another account with the same reference gets 409 and no purchase or account data", async () => {
    const shop = await openShop();
    const { purchase } = await submitAs(shop, "01713000002", "TRXREPLAY02");
    const other = await signInCustomer(harness, shop.organizationId, "01713000003");

    const response = await submit({
      shop,
      customer: other,
      phone: "+8801713000003",
      reference: "TRXREPLAY02",
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe(ERROR_CODE.CONFLICT);
    const body = JSON.stringify(response.body);
    expect(body).not.toContain(purchase.creditPurchaseId);
    expect(body).not.toContain(purchase.purchaseNumber);
    expect(body).not.toContain(purchase.customerAccountId);
  });

  it("the same account with another pack and the same reference stays 409", async () => {
    const shop = await openShop();
    const { customer } = await submitAs(shop, "01713000004", "TRXREPLAY03");
    const otherPack = await shop.world.alice.call("post", packsPath(shop.organizationId), {
      name: { bn: "২০ ক্রেডিট", en: "20 Credits" },
      credits: 20,
      price: { amount: 900, currency: "BDT" },
      validityDays: 30,
      sortOrder: 2,
    });

    const response = await submit({
      shop,
      customer,
      phone: "+8801713000004",
      reference: "TRXREPLAY03",
      creditPackId: dataOf<CreditPack>(otherPack).creditPackId,
    });

    expect(response.status).toBe(409);
  });
});

describe("credit purchase verify and limits (R1 item 5 a-d)", () => {
  it("(a) two parallel verifies both answer 200 and the balance rises once", async () => {
    const shop = await openShop();
    const { customer, purchase } = await submitAs(shop, "01714000001", "TRXPARALLEL1");

    const [first, second] = await Promise.all([
      verifyAs(shop.world.alice, shop, purchase, { version: 1 }),
      verifyAs(shop.world.alice, shop, purchase, { version: 1 }),
    ]);

    expect([first.status, second.status]).toEqual([200, 200]);
    expect((await balanceOf(shop, customer)).body.data.balance).toBe(10);
    const entries = await harness.connections.tenantShared
      .collection("credit_entries")
      .countDocuments({
        organizationId: shop.organizationId,
        "source.sourceId": purchase.creditPurchaseId,
      });
    expect(entries).toBe(1);
  });

  it("(b) the 11th submission from one account in an hour is 429", async () => {
    const shop = await openShop([{ settingKey: CREDIT_RULE_KEY.PURCHASE_MAX_PENDING, value: 20 }]);
    const customer = await signInCustomer(harness, shop.organizationId, "01714000002");

    const statuses: number[] = [];
    for (let index = 0; index < 11; index += 1) {
      const response = await submit({
        shop,
        customer,
        phone: "+8801714000002",
        reference: `TRXHOURLY${String(index).padStart(2, "0")}`,
      });
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(201));
    expect(statuses[10]).toBe(429);
  });

  it("(c) the grant uses the pack snapshot, not the pack as it is edited later", async () => {
    const shop = await openShop();
    const { customer, purchase } = await submitAs(shop, "01714000003", "TRXSNAPSHOT1");
    const edit = await shop.world.alice.call(
      "patch",
      `${packsPath(shop.organizationId)}/${shop.pack.creditPackId}`,
      {
        name: shop.pack.name,
        validityDays: shop.pack.validityDays,
        sortOrder: shop.pack.sortOrder,
        version: shop.pack.version,
        credits: 99,
        price: { amount: 900, currency: "BDT" },
      },
    );
    expect(edit.status, JSON.stringify(edit.body)).toBe(200);

    const verified = await verifyAs(shop.world.alice, shop, purchase, { version: 1 });

    expect(verified.status).toBe(200);
    expect(dataOf<CreditPurchaseResponse>(verified).snapshot.price.amount).toBe(500);
    expect((await balanceOf(shop, customer)).body.data.balance).toBe(10);
  });

  it("(d) a method that is not configured is 422, also with the empty default", async () => {
    const shop = await openShop();
    const customer = await signInCustomer(harness, shop.organizationId, "01714000004");
    const patchRes1 = await ownerOf(shop.world, shop.organizationId).call(
      "patch",
      `/orgs/${shop.organizationId}/settings`,
      {
        items: [
          {
            settingKey: CREDIT_RULE_KEY.PAYMENT_METHODS,
            value: METHODS_SETTING.filter((item) => item.method === CREDIT_PURCHASE_METHOD.BKASH),
            version: 1,
          },
        ],
      },
    );
    expect(patchRes1.status).toBe(200);

    const nagad = await submit({
      shop,
      customer,
      phone: "+8801714000004",
      reference: "TRXMETHOD001",
      method: CREDIT_PURCHASE_METHOD.NAGAD,
    });

    expect(nagad.status).toBe(422);
    expect(nagad.body.error.messageKey).toBe("errors.credit_payment_method_not_configured");

    const patchRes2 = await ownerOf(shop.world, shop.organizationId).call(
      "patch",
      `/orgs/${shop.organizationId}/settings`,
      {
        items: [{ settingKey: CREDIT_RULE_KEY.PAYMENT_METHODS, value: [], version: 2 }],
      },
    );
    expect(patchRes2.status).toBe(200);
    const none = await submit({
      shop,
      customer,
      phone: "+8801714000004",
      reference: "TRXMETHOD002",
    });
    expect(none.status).toBe(422);
  });
});

describe("credit purchase approval tokens and access (R1 item 5 e-h)", () => {
  it("(e) an approval token is single-use and bound to its purchase", async () => {
    const shop = await openShop([
      { settingKey: CREDIT_RULE_KEY.PURCHASE_APPROVAL_ABOVE, value: 400 },
    ]);
    const { organizationId, world } = shop;
    const staffRoleId = await findSystemRoleId(
      harness.connections,
      organizationId,
      SYSTEM_ROLE_KEY.STAFF,
    );
    const staff = await addMemberWithAssignments(harness.app, organizationId, [
      { locationId: ALL_LOCATIONS, roleId: staffRoleId },
    ]);
    const managerRoleId = await findSystemRoleId(
      harness.connections,
      organizationId,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const manager = await addMemberWithAssignments(harness.app, organizationId, [
      { locationId: world.locationA1, roleId: managerRoleId },
    ]);
    const pin = await manager.actor.call("put", `/orgs/${organizationId}/me/approval-pin`, {
      currentPassword: API_PASSWORD,
      pin: "4321",
    });
    expect(pin.status).toBe(204);
    const purchaseA = (await submitAs(shop, "01715000001", "TRXTOKENA001")).purchase;
    const purchaseB = (await submitAs(shop, "01715000002", "TRXTOKENB001")).purchase;
    const purchaseC = (await submitAs(shop, "01715000003", "TRXTOKENC001")).purchase;
    const tokenFor = async (purchase: CreditPurchaseResponse): Promise<string> => {
      const approval = await staff.actor.call("post", `/orgs/${organizationId}/approvals`, {
        action: APPROVAL_ACTION.CREDIT_PURCHASE_VERIFY,
        subjectKey: purchase.creditPurchaseId,
        amount: { amount: 500, currency: "BDT" },
        locationId: world.locationA1,
        approverMemberId: manager.memberId,
        pin: "4321",
      });
      expect(approval.status).toBe(200);
      return approval.body.data.approvalToken as string;
    };
    const tokenA = await tokenFor(purchaseA);
    const tokenC = await tokenFor(purchaseC);

    const verifyA = await verifyAs(staff.actor, shop, purchaseA, {
      version: 1,
      approvalToken: tokenA,
    });
    const reuseOnB = await verifyAs(staff.actor, shop, purchaseB, {
      version: 1,
      approvalToken: tokenA,
    });
    const tokenOfCOnB = await verifyAs(staff.actor, shop, purchaseB, {
      version: 1,
      approvalToken: tokenC,
    });

    expect(verifyA.status).toBe(200);
    expect(reuseOnB.status).toBe(403);
    expect(reuseOnB.body.error.code).toBe(ERROR_CODE.APPROVAL_REQUIRED);
    expect(tokenOfCOnB.status).toBe(403);
    expect(tokenOfCOnB.body.error.code).toBe(ERROR_CODE.APPROVAL_REQUIRED);
    const stillPending = await world.alice.call(
      "get",
      `${staffPath(organizationId)}/${purchaseB.creditPurchaseId}`,
    );
    expect(dataOf<CreditPurchaseResponse>(stillPending).status).toBe(
      CREDIT_PURCHASE_STATUS.PENDING,
    );
  });

  it("(f) a member without the credit purchase permissions is 403 on verify, reject and list", async () => {
    const shop = await openShop();
    const { purchase } = await submitAs(shop, "01716000001", "TRXPERMISS01");
    const viewerRoleId = await findSystemRoleId(
      harness.connections,
      shop.organizationId,
      SYSTEM_ROLE_KEY.VIEWER,
    );
    const viewer = await addMemberWithAssignments(harness.app, shop.organizationId, [
      { locationId: ALL_LOCATIONS, roleId: viewerRoleId },
    ]);

    const verify = await verifyAs(viewer.actor, shop, purchase, { version: 1 });
    const reject = await viewer.actor.call(
      "post",
      `${staffPath(shop.organizationId)}/${purchase.creditPurchaseId}/reject`,
      { version: 1, reason: "Not allowed" },
    );
    const list = await viewer.actor.call("get", staffPath(shop.organizationId));

    expect([verify.status, reject.status, list.status]).toEqual([403, 403, 403]);
  });

  it("(g) a customer session of another organization is 401 on both purchase routes", async () => {
    const shop = await openShop();
    const customerOfA = await signInCustomer(harness, shop.organizationId, "01717000001");

    const submitInB = await submit({
      shop,
      customer: customerOfA,
      phone: "+8801717000001",
      reference: "TRXCROSSORG1",
      organizationId: shop.world.organizationB,
    });
    const listInB = await callStorefront(harness.app, {
      organizationId: shop.world.organizationB,
      suffix: "/my/credit-purchases",
      method: "get",
      cookies: asCustomerCookies(customerOfA.session),
    });

    expect(submitInB.status).toBe(401);
    expect(listInB.status).toBe(401);
  });

  it("(h) one customer never sees or cancels another customer's purchase", async () => {
    const shop = await openShop();
    const { purchase } = await submitAs(shop, "01718000001", "TRXNOLEAK001");
    const customerB = await signInCustomer(harness, shop.organizationId, "01718000002");

    const list = await callStorefront(harness.app, {
      organizationId: shop.organizationId,
      suffix: "/my/credit-purchases",
      method: "get",
      cookies: asCustomerCookies(customerB.session),
    });
    const cancel = await callStorefront(harness.app, {
      organizationId: shop.organizationId,
      suffix: `/credit-purchases/${purchase.creditPurchaseId}/cancel`,
      method: "post",
      cookies: asCustomerCookies(customerB.session),
    });

    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain(purchase.creditPurchaseId);
    expect(cancel.status).toBe(404);
  });
});

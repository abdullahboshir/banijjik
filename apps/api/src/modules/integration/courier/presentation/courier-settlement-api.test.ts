import { ERROR_CODE, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { memberWithRole } from "../../../../test-support/catalog-world.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import type { SalesShop } from "../../../../test-support/sales-api-world.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";
import {
  confirmedCourierOrder,
  createCourierProduct,
  createDirectPayment,
  grantSettlementReversalApproval,
  shopOf,
  startCatalogApi,
  worldFor,
  type TestOffering,
} from "./courier-api-world.js";

const RETAIL = { industryTemplateKey: "RETAIL" };

let harness: IamApiHarness;
let world: TwoOrganizations;
let shopA: SalesShop;
let productA: TestOffering;

beforeAll(async () => {
  harness = await startCatalogApi();
  world = await worldFor(harness, RETAIL);
  shopA = shopOf(world);
  productA = await createCourierProduct(shopA, "Settlement Item");
});

afterAll(async () => {
  await harness.dispose();
});

describe("courier settlement API", () => {
  it("records a settlement with gross matching payment sums and net received calculated", async () => {
    const order1 = await confirmedCourierOrder(shopA, productA);
    const order2 = await confirmedCourierOrder(shopA, productA);
    const pay1 = await createDirectPayment(shopA, order1.orderId, 3_000);
    const pay2 = await createDirectPayment(shopA, order2.orderId, 2_000);
    const ref = `ref-${newId().slice(-8)}`;

    const response = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/courier/settlements`,
      idempotencyKey: newId(),
      body: {
        courierKey: "STEADFAST",
        paymentIds: [pay1, pay2],
        courierChargesMinor: 350,
        receivedVia: "BANK",
        externalReference: ref,
        businessDate: "2026-11-06",
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.data.grossAmount).toEqual({ amount: 5_000, currency: "BDT" });
    expect(response.body.data.courierCharges).toEqual({ amount: 350, currency: "BDT" });
    expect(response.body.data.netReceived).toEqual({ amount: 4_650, currency: "BDT" });
    expect(response.body.data.externalReference).toBe(ref);
  });

  it("rejects settlement when a payment belongs to a foreign org or does not exist", async () => {
    const foreignPayment = newId();

    const response = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/courier/settlements`,
      idempotencyKey: newId(),
      body: {
        courierKey: "PATHAO",
        paymentIds: [foreignPayment],
        courierChargesMinor: 50,
        receivedVia: "BKASH",
        externalReference: `ref-${newId().slice(-8)}`,
        businessDate: "2026-11-06",
      },
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe(ERROR_CODE.BUSINESS_RULE);
  });

  it("rejects settlement when courier charges exceed gross payment amount", async () => {
    const order = await confirmedCourierOrder(shopA, productA);
    const payment = await createDirectPayment(shopA, order.orderId, 1_000);

    const response = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/courier/settlements`,
      idempotencyKey: newId(),
      body: {
        courierKey: "REDX",
        paymentIds: [payment],
        courierChargesMinor: 1_500,
        receivedVia: "BANK",
        externalReference: `ref-${newId().slice(-8)}`,
        businessDate: "2026-11-06",
      },
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe(ERROR_CODE.BUSINESS_RULE);
  });

  it("rejects duplicate external reference for the same courier", async () => {
    const order1 = await confirmedCourierOrder(shopA, productA);
    const order2 = await confirmedCourierOrder(shopA, productA);
    const pay1 = await createDirectPayment(shopA, order1.orderId, 2_000);
    const pay2 = await createDirectPayment(shopA, order2.orderId, 2_000);
    const ref = `ref-dup-${newId().slice(-8)}`;

    const first = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/courier/settlements`,
      idempotencyKey: newId(),
      body: {
        courierKey: "STEADFAST",
        paymentIds: [pay1],
        courierChargesMinor: 100,
        receivedVia: "BANK",
        externalReference: ref,
        businessDate: "2026-11-06",
      },
    });
    expect(first.status).toBe(200);

    const dup = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/courier/settlements`,
      idempotencyKey: newId(),
      body: {
        courierKey: "STEADFAST",
        paymentIds: [pay2],
        courierChargesMinor: 100,
        receivedVia: "BANK",
        externalReference: ref,
        businessDate: "2026-11-06",
      },
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe(ERROR_CODE.CONFLICT);
  });

  it("reverses a settlement with approval token and prevents second reversal", async () => {
    const order = await confirmedCourierOrder(shopA, productA);
    const pay = await createDirectPayment(shopA, order.orderId, 2_500);

    const settlementRes = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/courier/settlements`,
      idempotencyKey: newId(),
      body: {
        courierKey: "STEADFAST",
        paymentIds: [pay],
        courierChargesMinor: 200,
        receivedVia: "BANK",
        externalReference: `ref-rev-${newId().slice(-8)}`,
        businessDate: "2026-11-06",
      },
    });
    expect(settlementRes.status).toBe(200);
    const settlementId = settlementRes.body.data.courierSettlementId as string;

    const token = await grantSettlementReversalApproval(world, settlementId, shopA.locationId);

    const reverseRes = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/courier/settlements/${settlementId}/reverse`,
      idempotencyKey: newId(),
      body: {
        version: settlementRes.body.data.version,
        reason: "Entered wrong charges",
        approvalToken: token,
      },
    });

    expect(reverseRes.status).toBe(200);
    expect(reverseRes.body.data.reversesCourierSettlementId).toBe(settlementId);
    expect(reverseRes.body.data.reversalReason).toBe("Entered wrong charges");

    const token2 = await grantSettlementReversalApproval(world, settlementId, shopA.locationId);
    const secondReverse = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/courier/settlements/${settlementId}/reverse`,
      idempotencyKey: newId(),
      body: {
        version: settlementRes.body.data.version,
        reason: "Second reversal attempt",
        approvalToken: token2,
      },
    });
    expect(secondReverse.status).toBe(409);
    expect(secondReverse.body.error.code).toBe(ERROR_CODE.CONFLICT);
  });

  it("replays settlement recording with idempotency key", async () => {
    const order = await confirmedCourierOrder(shopA, productA);
    const pay = await createDirectPayment(shopA, order.orderId, 1_500);
    const key = newId();
    const body = {
      courierKey: "OTHER" as const,
      paymentIds: [pay],
      courierChargesMinor: 80,
      receivedVia: "CASH" as const,
      externalReference: `ref-idmp-${newId().slice(-8)}`,
      businessDate: "2026-11-06",
    };

    const first = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/courier/settlements`,
      idempotencyKey: key,
      body,
    });
    expect(first.status).toBe(200);

    const replayed = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/courier/settlements`,
      idempotencyKey: key,
      body,
    });
    expect(replayed.status).toBe(200);
    expect(replayed.headers["idempotency-replayed"]).toBe("true");
    expect(replayed.body.data.courierSettlementId).toBe(first.body.data.courierSettlementId);
  });

  it("enforces settlement permissions and cross-organization isolation", async () => {
    const viewer = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.VIEWER);

    const denied = await viewer.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/courier/settlements`,
      idempotencyKey: newId(),
      body: {
        courierKey: "STEADFAST",
        paymentIds: [newId()],
        courierChargesMinor: 50,
        receivedVia: "BANK",
        externalReference: `ref-${newId().slice(-8)}`,
        businessDate: "2026-11-06",
      },
    });
    expect(denied.status).toBe(403);

    const foreign = await world.bob.call(
      "post",
      `/orgs/${world.organizationA}/courier/settlements`,
      {
        courierKey: "STEADFAST",
        paymentIds: [newId()],
        courierChargesMinor: 50,
        receivedVia: "BANK",
        externalReference: `ref-${newId().slice(-8)}`,
        businessDate: "2026-11-06",
      },
    );
    expect(foreign.status).toBe(404);
  });
});

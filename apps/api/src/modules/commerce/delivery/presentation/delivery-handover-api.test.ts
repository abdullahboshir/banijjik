import { ERROR_CODE, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { memberWithRole } from "../../../../test-support/catalog-world.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import type { AddedMember } from "../../../../test-support/rbac-world.js";
import type { SalesShop } from "../../../../test-support/sales-api-world.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";
import {
  confirmedRiderOrder,
  createDeliveryProduct,
  createDirectPayment,
  createRiderMember,
  grantHandoverReversalApproval,
  shopOf,
  startCatalogApi,
  worldFor,
  type TestOffering,
} from "./delivery-api-world.js";

const RETAIL = { industryTemplateKey: "RETAIL" };

let harness: IamApiHarness;
let world: TwoOrganizations;
let shopA: SalesShop;
let productA: TestOffering;
let riderA: AddedMember;

beforeAll(async () => {
  harness = await startCatalogApi();
  world = await worldFor(harness, RETAIL);
  shopA = shopOf(world);
  productA = await createDeliveryProduct(shopA, "Handover Item");
  riderA = await createRiderMember(harness, world, shopA.locationId);
});

afterAll(async () => {
  await harness.dispose();
});

describe("delivery handover API", () => {
  it("records a cash handover from rider to staff with matching payment sum", async () => {
    const order1 = await confirmedRiderOrder(shopA, productA);
    const order2 = await confirmedRiderOrder(shopA, productA);

    const pay1 = await createDirectPayment(shopA, order1.orderId, 2_000);
    const pay2 = await createDirectPayment(shopA, order2.orderId, 3_000);

    const response = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/delivery/handovers`,
      idempotencyKey: newId(),
      body: {
        riderMemberId: riderA.memberId,
        paymentIds: [pay1, pay2],
        receivedVia: "CASH",
        businessDate: "2026-11-06",
      },
    });

    expect(response.status).toBe(200);
    const handover = response.body.data;
    expect(handover.riderCashHandoverId).toBeDefined();
    expect(handover.riderMemberId).toBe(riderA.memberId);
    expect(handover.amount).toEqual({ amount: 5_000, currency: "BDT" });
    expect(handover.receivedVia).toBe("CASH");
    expect(handover.reversesRiderCashHandoverId).toBeNull();
    expect(handover.version).toBe(1);
  });

  it("rejects handover when rider attempts to approve their own handover", async () => {
    const order = await confirmedRiderOrder(shopA, productA);
    const pay = await createDirectPayment(shopA, order.orderId, 1_000);

    const response = await riderA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/delivery/handovers`,
      idempotencyKey: newId(),
      body: {
        riderMemberId: riderA.memberId,
        paymentIds: [pay],
        receivedVia: "CASH",
        businessDate: "2026-11-06",
      },
    });

    expect(response.status).toBe(422);
    expect(response.body.error.messageKey).toBe("errors.rider_cannot_approve_own_handover");
  });

  it("rejects handover when payment is not found", async () => {
    const response = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/delivery/handovers`,
      idempotencyKey: newId(),
      body: {
        riderMemberId: riderA.memberId,
        paymentIds: [newId()],
        receivedVia: "CASH",
        businessDate: "2026-11-06",
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.error.messageKey).toBe("errors.payment_not_eligible_for_handover");
  });

  it("reverses a handover with approval token and prevents second reversal", async () => {
    const order = await confirmedRiderOrder(shopA, productA);
    const pay = await createDirectPayment(shopA, order.orderId, 2_500);

    const recorded = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/delivery/handovers`,
      idempotencyKey: newId(),
      body: {
        riderMemberId: riderA.memberId,
        paymentIds: [pay],
        receivedVia: "CASH",
        businessDate: "2026-11-06",
      },
    });
    expect(recorded.status).toBe(200);
    const handoverId = recorded.body.data.riderCashHandoverId as string;

    const token = await grantHandoverReversalApproval(world, handoverId, shopA.locationId);

    const reversed = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/delivery/handovers/${handoverId}/reverse`,
      idempotencyKey: newId(),
      body: {
        version: 1,
        reason: "Wrong cash count, recounting with rider",
        approvalToken: token,
      },
    });

    expect(reversed.status).toBe(200);
    expect(reversed.body.data.reversesRiderCashHandoverId).toBe(handoverId);
    expect(reversed.body.data.amount).toEqual({ amount: -2_500, currency: "BDT" });
    expect(reversed.body.data.reversalReason).toBe("Wrong cash count, recounting with rider");

    const secondToken = await grantHandoverReversalApproval(world, handoverId, shopA.locationId);
    const secondReversal = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/delivery/handovers/${handoverId}/reverse`,
      idempotencyKey: newId(),
      body: {
        version: 1,
        reason: "Another reversal attempt",
        approvalToken: secondToken,
      },
    });
    expect(secondReversal.status).toBe(409);
    expect(secondReversal.body.error.messageKey).toBe("errors.handover_already_reversed");
  });

  it("replays handover recording with idempotency key", async () => {
    const order = await confirmedRiderOrder(shopA, productA);
    const pay = await createDirectPayment(shopA, order.orderId, 1_500);
    const key = newId();
    const body = {
      riderMemberId: riderA.memberId,
      paymentIds: [pay],
      receivedVia: "CASH" as const,
      businessDate: "2026-11-06",
    };

    const first = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/delivery/handovers`,
      idempotencyKey: key,
      body,
    });
    expect(first.status).toBe(200);

    const replayed = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/delivery/handovers`,
      idempotencyKey: key,
      body,
    });
    expect(replayed.status).toBe(200);
    expect(replayed.headers["idempotency-replayed"]).toBe("true");
    expect(replayed.body.data.riderCashHandoverId).toBe(first.body.data.riderCashHandoverId);
  });

  it("enforces permissions and cross-organization isolation", async () => {
    const viewer = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.VIEWER);

    const denied = await viewer.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/delivery/handovers`,
      idempotencyKey: newId(),
      body: {
        riderMemberId: riderA.memberId,
        paymentIds: [newId()],
        receivedVia: "CASH",
        businessDate: "2026-11-06",
      },
    });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe(ERROR_CODE.FORBIDDEN);

    const foreign = await world.bob.call(
      "post",
      `/orgs/${world.organizationA}/delivery/handovers`,
      {
        riderMemberId: riderA.memberId,
        paymentIds: [newId()],
        receivedVia: "CASH",
        businessDate: "2026-11-06",
      },
    );
    expect(foreign.status).toBe(404);
  });
});

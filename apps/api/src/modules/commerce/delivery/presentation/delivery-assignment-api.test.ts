import { ERROR_CODE, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { ORDER_STATUS } from "@banijjik/contracts/sales";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { memberWithRole } from "../../../../test-support/catalog-world.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  draftOrder as baseDraftOrder,
  getOrder,
  type SalesShop,
} from "../../../../test-support/sales-api-world.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";
import {
  addCustomer,
  confirmedRiderOrder,
  createDeliveryProduct,
  createRiderMember,
  DHAKA_ADDRESS,
  ensureDeliveryZone,
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
let riderA: { readonly memberId: string };

beforeAll(async () => {
  harness = await startCatalogApi();
  world = await worldFor(harness, RETAIL);
  shopA = shopOf(world);
  productA = await createDeliveryProduct(shopA, "Rider Item");
  riderA = await createRiderMember(harness, world, shopA.locationId);
});

afterAll(async () => {
  await harness.dispose();
});

describe("delivery assignment API", () => {
  it("creates an assignment with shipOrder: true and ships the order", async () => {
    const order = await confirmedRiderOrder(shopA, productA);

    const response = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/delivery/assignments`,
      idempotencyKey: newId(),
      body: {
        orderId: order.orderId,
        riderMemberId: riderA.memberId,
        notes: "Call upon arrival",
        shipOrder: true,
      },
    });

    expect(response.status).toBe(200);
    const assignment = response.body.data;
    expect(assignment.deliveryAssignmentId).toBeDefined();
    expect(assignment.orderId).toBe(order.orderId);
    expect(assignment.riderMemberId).toBe(riderA.memberId);
    expect(assignment.attemptOrdinal).toBe(1);
    expect(assignment.status).toBe("ASSIGNED");

    const shipped = await getOrder(shopA, order.orderId);
    expect(shipped.status).toBe(ORDER_STATUS.SHIPPED);
  });

  it("creates an assignment with shipOrder: false without changing order status", async () => {
    const order = await confirmedRiderOrder(shopA, productA);

    const response = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/delivery/assignments`,
      idempotencyKey: newId(),
      body: {
        orderId: order.orderId,
        riderMemberId: riderA.memberId,
        shipOrder: false,
      },
    });

    expect(response.status).toBe(200);
    const assignment = response.body.data;
    expect(assignment.attemptOrdinal).toBe(1);

    const unchanged = await getOrder(shopA, order.orderId);
    expect(unchanged.status).toBe(ORDER_STATUS.CONFIRMED);
  });

  it("rejects assignment when order fulfillment method is not OWN_RIDER", async () => {
    await ensureDeliveryZone(shopA);
    const contactId = await addCustomer(shopA, "Non Rider", "+8801799990001");
    const nonRiderOrder = await baseDraftOrder(shopA, {
      locationId: shopA.locationId,
      contactId,
      fulfillmentMethod: "COURIER",
      deliveryAddress: DHAKA_ADDRESS,
      lines: [{ offeringId: productA.offeringId, variantId: productA.variantId, quantity: 1 }],
    });

    const response = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/delivery/assignments`,
      idempotencyKey: newId(),
      body: {
        orderId: nonRiderOrder.orderId,
        riderMemberId: riderA.memberId,
      },
    });

    expect(response.status).toBe(422);
    expect(response.body.error.messageKey).toBe("errors.delivery_fulfillment_mismatch");
  });

  it("rejects assignment when rider is not assigned to order location", async () => {
    const foreignLocationRider = await createRiderMember(harness, world, world.locationA2);
    const order = await confirmedRiderOrder(shopA, productA);

    const response = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/delivery/assignments`,
      idempotencyKey: newId(),
      body: {
        orderId: order.orderId,
        riderMemberId: foreignLocationRider.memberId,
      },
    });

    expect(response.status).toBe(422);
    expect(response.body.error.messageKey).toBe("errors.rider_not_assigned_to_location");
  });

  it("lists delivery assignments with filters and pagination", async () => {
    const list = await shopA.actor.call(
      "get",
      `/orgs/${shopA.organizationId}/delivery/assignments?riderMemberId=${riderA.memberId}&page=1&limit=10`,
    );

    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data.items)).toBe(true);
    expect(list.body.data.total).toBeGreaterThanOrEqual(1);
  });

  it("replays assignment creation with idempotency key", async () => {
    const order = await confirmedRiderOrder(shopA, productA);
    const key = newId();
    const body = {
      orderId: order.orderId,
      riderMemberId: riderA.memberId,
      shipOrder: false,
    };

    const first = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/delivery/assignments`,
      idempotencyKey: key,
      body,
    });
    expect(first.status).toBe(200);

    const replayed = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/delivery/assignments`,
      idempotencyKey: key,
      body,
    });
    expect(replayed.status).toBe(200);
    expect(replayed.headers["idempotency-replayed"]).toBe("true");
    expect(replayed.body.data.deliveryAssignmentId).toBe(first.body.data.deliveryAssignmentId);
  });

  it("enforces permissions and cross-organization isolation", async () => {
    const viewer = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.VIEWER);

    const denied = await viewer.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/delivery/assignments`,
      idempotencyKey: newId(),
      body: {
        orderId: newId(),
        riderMemberId: riderA.memberId,
      },
    });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe(ERROR_CODE.FORBIDDEN);

    const foreign = await world.bob.call(
      "post",
      `/orgs/${world.organizationA}/delivery/assignments`,
      {
        orderId: newId(),
        riderMemberId: riderA.memberId,
      },
    );
    expect(foreign.status).toBe(404);
  });
});

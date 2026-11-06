import { ERROR_CODE, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { ORDER_STATUS } from "@banijjik/contracts/sales";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { memberWithRole } from "../../../../test-support/catalog-world.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { getOrder, type SalesShop } from "../../../../test-support/sales-api-world.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";
import {
  confirmedCourierOrder,
  createCourierProduct,
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
  productA = await createCourierProduct(shopA, "Courier Item");
});

afterAll(async () => {
  await harness.dispose();
});

describe("courier consignment API", () => {
  it("creates a consignment with shipOrder: true and ships the order", async () => {
    const order = await confirmedCourierOrder(shopA, productA);
    const tracking = `trk-${newId().slice(-8)}`;

    const response = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/courier/consignments`,
      idempotencyKey: newId(),
      body: {
        orderId: order.orderId,
        courierKey: "STEADFAST",
        trackingNumber: tracking,
        shipOrder: true,
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.data.courierKey).toBe("STEADFAST");
    expect(response.body.data.trackingNumber).toBe(tracking);
    expect(response.body.data.status).toBe("BOOKED");
    expect(response.body.data.attemptOrdinal).toBe(1);

    const refreshed = await getOrder(shopA, order.orderId);
    expect(refreshed.status).toBe(ORDER_STATUS.SHIPPED);
    expect(refreshed.delivery?.deliveryAttemptCount).toBe(1);

    const attempts = await shopA.actor.call(
      "get",
      `/orgs/${shopA.organizationId}/orders/${order.orderId}/delivery-attempts`,
    );
    expect(attempts.status).toBe(200);
    expect(attempts.body.data.length).toBe(1);
    expect(attempts.body.data[0].consignmentId).toBe(response.body.data.consignmentId);
  });

  it("creates a consignment with shipOrder: false without changing order status", async () => {
    const order = await confirmedCourierOrder(shopA, productA);
    const tracking = `trk-${newId().slice(-8)}`;

    const response = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/courier/consignments`,
      idempotencyKey: newId(),
      body: {
        orderId: order.orderId,
        courierKey: "PATHAO",
        trackingNumber: tracking,
        shipOrder: false,
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("BOOKED");

    const refreshed = await getOrder(shopA, order.orderId);
    expect(refreshed.status).toBe(ORDER_STATUS.CONFIRMED);
    expect(refreshed.delivery?.deliveryAttemptCount ?? 0).toBe(0);
  });

  it("rejects duplicate tracking number for the same courier", async () => {
    const order1 = await confirmedCourierOrder(shopA, productA);
    const order2 = await confirmedCourierOrder(shopA, productA);
    const tracking = `trk-${newId().slice(-8)}`;

    const first = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/courier/consignments`,
      idempotencyKey: newId(),
      body: {
        orderId: order1.orderId,
        courierKey: "REDX",
        trackingNumber: tracking,
        shipOrder: false,
      },
    });
    expect(first.status).toBe(200);

    const duplicate = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/courier/consignments`,
      idempotencyKey: newId(),
      body: {
        orderId: order2.orderId,
        courierKey: "REDX",
        trackingNumber: tracking,
        shipOrder: false,
      },
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe(ERROR_CODE.CONFLICT);
  });

  it("lists consignments with filters and pagination", async () => {
    const order = await confirmedCourierOrder(shopA, productA);
    const tracking = `trk-flt-${newId().slice(-8)}`;

    await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/courier/consignments`,
      idempotencyKey: newId(),
      body: {
        orderId: order.orderId,
        courierKey: "PAPERFLY",
        trackingNumber: tracking,
        shipOrder: false,
      },
    });

    const list = await shopA.actor.call(
      "get",
      `/orgs/${shopA.organizationId}/courier/consignments?orderId=${order.orderId}&courierKey=PAPERFLY&page=1&limit=10`,
    );

    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(1);
    expect(list.body.data[0].trackingNumber).toBe(tracking);
    expect(list.body.meta.hasNext).toBe(false);
  });

  it("replays consignment creation with idempotency key", async () => {
    const order = await confirmedCourierOrder(shopA, productA);
    const key = newId();
    const tracking = `trk-idmp-${newId().slice(-8)}`;
    const body = {
      orderId: order.orderId,
      courierKey: "STEADFAST",
      trackingNumber: tracking,
      shipOrder: false,
    };

    const first = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/courier/consignments`,
      idempotencyKey: key,
      body,
    });
    expect(first.status).toBe(200);

    const replayed = await shopA.actor.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/courier/consignments`,
      idempotencyKey: key,
      body,
    });
    expect(replayed.status).toBe(200);
    expect(replayed.headers["idempotency-replayed"]).toBe("true");
    expect(replayed.body.data.consignmentId).toBe(first.body.data.consignmentId);
  });

  it("enforces permissions and cross-organization isolation", async () => {
    const viewer = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.VIEWER);
    const order = await confirmedCourierOrder(shopA, productA);

    const denied = await viewer.callWith({
      method: "post",
      path: `/orgs/${shopA.organizationId}/courier/consignments`,
      idempotencyKey: newId(),
      body: {
        orderId: order.orderId,
        courierKey: "STEADFAST",
        trackingNumber: `trk-${newId().slice(-8)}`,
      },
    });
    expect(denied.status).toBe(403);

    const foreign = await world.bob.call(
      "get",
      `/orgs/${world.organizationA}/courier/consignments`,
    );
    expect(foreign.status).toBe(404);
  });
});

import { IDEMPOTENCY_REPLAYED_HEADER, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  memberWithRole,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  bdt,
  closeRegister,
  lineOf,
  openRegister,
  pairedTill,
  posPath,
  saleCall,
  stockedPack,
  tillCall,
  type Pack,
  type PosTill,
} from "../../../../test-support/pos-api-world.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import {
  addCustomer,
  instantOrder,
  shopOf,
  type SalesShop,
} from "../../../../test-support/sales-api-world.js";
import type { ApiActor, TwoOrganizations } from "../../../../test-support/two-organizations.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const PRICE = 10_000;
const FLOAT = 5_000;

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

interface Counter {
  readonly world: TwoOrganizations;
  readonly shop: SalesShop;
  readonly manager: ApiActor;
  readonly till: PosTill;
  readonly pack: Pack;
}

async function aCounter(): Promise<Counter> {
  const world = await worldFor(harness, RETAIL);
  const shop = shopOf(world);
  const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
  const till = await pairedTill(harness.app, {
    manager: world.alice,
    cashier,
    organizationId: world.organizationA,
    locationId: world.locationA1,
  });
  const pack = await stockedPack(shop, { packs: 10, priceAmount: PRICE });
  return { world, shop, manager: world.alice, till, pack };
}

async function seedBookingDue(input: {
  readonly organizationId: string;
  readonly locationId: string;
  readonly contactId: string;
  readonly offeringId: string;
  readonly variantId: string;
  readonly totalAmount: number;
}): Promise<string> {
  const bookingId = newId();
  const now = new Date();
  await harness.connections.tenantShared.collection("bookings").insertOne({
    bookingId,
    organizationId: input.organizationId,
    bookingNumber: "BKG-000001",
    locationId: input.locationId,
    contactId: input.contactId,
    offeringId: input.offeringId,
    variantId: input.variantId,
    kind: "APPOINTMENT",
    depositRequired: bdt(0),
    startsAt: now,
    endsAt: new Date(now.getTime() + 3_600_000),
    blockedEndsAt: new Date(now.getTime() + 3_600_000),
    resourceIds: [],
    providerMemberId: null,
    quantity: 1,
    price: {
      unitPrice: bdt(input.totalAmount),
      total: bdt(input.totalAmount),
      tax: bdt(0),
      currency: "BDT",
    },
    status: "CONFIRMED",
    source: "ADMIN",
    note: null,
    holdExpiresAt: null,
    history: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdByUserId: null,
    updatedByUserId: null,
  });
  return bookingId;
}

describe("POS due collections and cash returns", () => {
  it("a till collection pays an order due and a booking due in one transaction with the session id", async () => {
    const { shop, till, pack } = await aCounter();
    const session = await openRegister(till, FLOAT);
    const contactId = await addCustomer(shop, "Karim", "+8801700000061");
    const creditSale = await saleCall(till, {
      lines: [lineOf(pack)],
      payments: [{ method: "CASH", amount: bdt(6_000) }],
      contactId,
    });
    const orderId = creditSale.body.data.order.orderId as string;
    const bookingId = await seedBookingDue({
      organizationId: shop.organizationId,
      locationId: till.locationId,
      contactId,
      offeringId: pack.offeringId,
      variantId: pack.variantId,
      totalAmount: 3_000,
    });

    const collected = await tillCall(till, {
      method: "post",
      suffix: "/collections",
      body: {
        allocations: [
          { requestType: "ORDER", requestId: orderId, amount: bdt(4_000) },
          { requestType: "BOOKING", requestId: bookingId, amount: bdt(3_000) },
        ],
        payments: [{ method: "CASH", amount: bdt(7_000) }],
        cashTendered: bdt(10_000),
      },
    });

    expect(collected.status, JSON.stringify(collected.body)).toBe(201);
    expect(collected.body.data).toMatchObject({
      posSessionId: session.posSessionId,
      changeDue: bdt(3_000),
    });
    const paymentRow = await harness.connections.tenantShared
      .collection("payments")
      .findOne({ paymentId: collected.body.data.payments[0].paymentId });
    expect(paymentRow?.["posSessionId"]).toBe(session.posSessionId);
  });

  it("payments that do not equal the allocations are refused", async () => {
    const { shop, till, pack } = await aCounter();
    await openRegister(till, FLOAT);
    const contactId = await addCustomer(shop, "Karim", "+8801700000062");
    const creditSale = await saleCall(till, {
      lines: [lineOf(pack)],
      payments: [{ method: "CASH", amount: bdt(6_000) }],
      contactId,
    });

    const mismatch = await tillCall(till, {
      method: "post",
      suffix: "/collections",
      body: {
        allocations: [
          {
            requestType: "ORDER",
            requestId: creditSale.body.data.order.orderId,
            amount: bdt(4_000),
          },
        ],
        payments: [{ method: "CASH", amount: bdt(3_500) }],
      },
    });

    expect(mismatch.status).toBe(422);
    expect(mismatch.body.error.details.ruleKey).toBe("POS_COLLECTION_MISMATCH");
  });

  it("a due at another location is 403", async () => {
    const { world, shop, till, pack } = await aCounter();
    await openRegister(till, FLOAT);
    const contactId = await addCustomer(shop, "Karim", "+8801700000063");
    const bookingId = await seedBookingDue({
      organizationId: shop.organizationId,
      locationId: world.locationA2,
      contactId,
      offeringId: pack.offeringId,
      variantId: pack.variantId,
      totalAmount: 3_000,
    });

    const otherLocation = await tillCall(till, {
      method: "post",
      suffix: "/collections",
      body: {
        allocations: [{ requestType: "BOOKING", requestId: bookingId, amount: bdt(3_000) }],
        payments: [{ method: "CASH", amount: bdt(3_000) }],
      },
    });

    expect(otherLocation.status).toBe(403);
    expect(otherLocation.body.error.code).toBe("LOCATION_FORBIDDEN");
  });

  it("a POS cash return lowers the session's expected cash by the refund", async () => {
    const { manager, till, pack } = await aCounter();
    const session = await openRegister(till, FLOAT);
    const sale = await saleCall(till, {
      lines: [lineOf(pack)],
      payments: [{ method: "CASH", amount: bdt(PRICE) }],
    });
    const order = sale.body.data.order;

    const returned = await tillCall(till, {
      method: "post",
      suffix: "/returns",
      as: manager,
      body: {
        orderId: order.orderId,
        lines: [{ orderLineId: order.lines[0].orderLineId, quantity: 1, disposition: "RESTOCK" }],
        refundMethod: "CASH",
        reasonKey: "CHANGED_MIND",
      },
    });
    const closed = await closeRegister(till, { session, countedCash: FLOAT });

    expect(returned.status, JSON.stringify(returned.body)).toBe(201);
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    expect(closed.body.data.expectedCash).toEqual(bdt(FLOAT));
  });

  it("a POS return needs an open session when pos.requireShift is on", async () => {
    const { manager, till, pack } = await aCounter();
    const session = await openRegister(till, FLOAT);
    const sale = await saleCall(till, {
      lines: [lineOf(pack)],
      payments: [{ method: "CASH", amount: bdt(PRICE) }],
    });
    await closeRegister(till, { session, countedCash: FLOAT + PRICE });
    const order = sale.body.data.order;

    const withoutSession = await tillCall(till, {
      method: "post",
      suffix: "/returns",
      as: manager,
      body: {
        orderId: order.orderId,
        lines: [{ orderLineId: order.lines[0].orderLineId, quantity: 1, disposition: "RESTOCK" }],
        refundMethod: "CASH",
        reasonKey: "CHANGED_MIND",
      },
    });

    expect(withoutSession.status).toBe(409);
    expect(withoutSession.body.error.messageKey).toBe("errors.pos_session_required");
  });

  it("POST /refunds cannot set posSessionId", async () => {
    const { world, till, pack } = await aCounter();
    const session = await openRegister(till, FLOAT);
    const sale = await saleCall(till, {
      lines: [lineOf(pack)],
      payments: [{ method: "CASH", amount: bdt(PRICE) }],
    });

    const response = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/refunds`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: "CASH",
        amount: bdt(1_000),
        allocations: [
          {
            requestType: "ORDER",
            requestId: sale.body.data.order.orderId,
            amount: bdt(1_000),
          },
        ],
        posSessionId: session.posSessionId,
      },
    });

    expect(response.status).toBe(400);
  });

  it("the Z-report lists collections and returns by method", async () => {
    const { shop, manager, till, pack } = await aCounter();
    const contactId = await addCustomer(shop, "Nadia", "+8801700000064");
    const priorCreditSale = await instantOrder(shop, {
      locationId: till.locationId,
      contactId,
      lines: [lineOf(pack)],
    });
    expect(priorCreditSale.status).toBe(201);
    const session = await openRegister(till, FLOAT);
    const sale = await saleCall(till, {
      lines: [lineOf(pack)],
      payments: [{ method: "CASH", amount: bdt(PRICE) }],
    });
    expect(sale.status, JSON.stringify(sale.body)).toBe(201);
    const collected = await tillCall(till, {
      method: "post",
      suffix: "/collections",
      body: {
        allocations: [
          {
            requestType: "ORDER",
            requestId: priorCreditSale.order.orderId,
            amount: bdt(4_000),
          },
        ],
        payments: [{ method: "CARD", amount: bdt(4_000) }],
      },
    });
    expect(collected.status, JSON.stringify(collected.body)).toBe(201);
    const returned = await tillCall(till, {
      method: "post",
      suffix: "/returns",
      as: manager,
      body: {
        orderId: sale.body.data.order.orderId,
        lines: [
          {
            orderLineId: sale.body.data.order.lines[0].orderLineId,
            quantity: 1,
            disposition: "RESTOCK",
          },
        ],
        refundMethod: "CASH",
        reasonKey: "CHANGED_MIND",
      },
    });
    expect(returned.status, JSON.stringify(returned.body)).toBe(201);

    const closed = await closeRegister(till, { session, countedCash: FLOAT });
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    const report = await tillCall(till, {
      method: "get",
      suffix: `/sessions/${session.posSessionId}/z-report`,
    });

    expect(report.body.data.collections).toEqual([{ method: "CARD", total: bdt(4_000), count: 1 }]);
    expect(report.body.data.returns).toEqual({
      count: 1,
      value: bdt(PRICE),
      refunds: [{ method: "CASH", total: bdt(PRICE), count: 1 }],
    });
  });

  it("the same Idempotency-Key replays a collection and a POS return", async () => {
    const { shop, manager, till, pack } = await aCounter();
    await openRegister(till, FLOAT);
    const contactId = await addCustomer(shop, "Jamal", "+8801700000065");
    const creditSale = await saleCall(till, {
      lines: [lineOf(pack)],
      payments: [{ method: "CASH", amount: bdt(6_000) }],
      contactId,
    });
    const collectionKey = newId();
    const collectionBody = {
      allocations: [
        {
          requestType: "ORDER",
          requestId: creditSale.body.data.order.orderId,
          amount: bdt(4_000),
        },
      ],
      payments: [{ method: "CASH", amount: bdt(4_000) }],
    };

    const firstCollection = await tillCall(till, {
      method: "post",
      suffix: "/collections",
      body: collectionBody,
      idempotencyKey: collectionKey,
    });
    const replayedCollection = await tillCall(till, {
      method: "post",
      suffix: "/collections",
      body: collectionBody,
      idempotencyKey: collectionKey,
    });

    const returnKey = newId();
    const returnBody = {
      orderId: creditSale.body.data.order.orderId,
      lines: [
        {
          orderLineId: creditSale.body.data.order.lines[0].orderLineId,
          quantity: 1,
          disposition: "RESTOCK",
        },
      ],
      refundMethod: "CASH",
      reasonKey: "CHANGED_MIND",
    };
    const firstReturn = await tillCall(till, {
      method: "post",
      suffix: "/returns",
      as: manager,
      body: returnBody,
      idempotencyKey: returnKey,
    });
    const replayedReturn = await tillCall(till, {
      method: "post",
      suffix: "/returns",
      as: manager,
      body: returnBody,
      idempotencyKey: returnKey,
    });

    expect(firstCollection.status).toBe(201);
    expect(replayedCollection.headers[IDEMPOTENCY_REPLAYED_HEADER.toLowerCase()]).toBe("true");
    expect(replayedCollection.body.data).toEqual(firstCollection.body.data);
    expect(firstReturn.status).toBe(201);
    expect(replayedReturn.headers[IDEMPOTENCY_REPLAYED_HEADER.toLowerCase()]).toBe("true");
    expect(replayedReturn.body.data.salesReturnId).toBe(firstReturn.body.data.salesReturnId);
  });
});

describe("POS session reads", () => {
  it("the current session of a device, or none", async () => {
    const { till } = await aCounter();

    const beforeOpen = await tillCall(till, { method: "get", suffix: "/sessions/current" });
    const session = await openRegister(till, FLOAT);
    const whileOpen = await tillCall(till, { method: "get", suffix: "/sessions/current" });
    await closeRegister(till, { session, countedCash: FLOAT });
    const afterClose = await tillCall(till, { method: "get", suffix: "/sessions/current" });

    expect(beforeOpen.body.data).toBeNull();
    expect(whileOpen.body.data.posSessionId).toBe(session.posSessionId);
    expect(afterClose.body.data).toBeNull();
  });

  it("the session list is paged and limited to the caller's locations", async () => {
    const { world, till } = await aCounter();
    const cashier = till.cashier;
    const secondTill = await pairedTill(harness.app, {
      manager: world.alice,
      cashier,
      organizationId: world.organizationA,
      locationId: world.locationA2,
      name: "Branch 2 Till",
    });
    const first = await openRegister(till, 1_000);
    await closeRegister(till, { session: first, countedCash: 1_000 });
    await openRegister(till, 2_000);
    await openRegister(secondTill, 3_000);

    const managerRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const branchOneManager = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: managerRoleId },
    ]);

    const pageOne = await branchOneManager.actor.call(
      "get",
      posPath(world.organizationA, "/sessions?limit=1"),
    );
    const pageTwo = await branchOneManager.actor.call(
      "get",
      posPath(
        world.organizationA,
        `/sessions?limit=1&cursor=${encodeURIComponent(pageOne.body.data.nextCursor as string)}`,
      ),
    );
    const forbiddenBranch = await branchOneManager.actor.call(
      "get",
      posPath(world.organizationA, `/sessions?locationId=${world.locationA2}`),
    );

    expect(pageOne.status).toBe(200);
    expect(pageOne.body.data.items).toHaveLength(1);
    expect(pageOne.body.data.items[0].locationId).toBe(world.locationA1);
    expect(pageOne.body.data.nextCursor).not.toBeNull();
    expect(pageTwo.body.data.items).toHaveLength(1);
    expect(pageTwo.body.data.items[0].posSessionId).toBe(first.posSessionId);
    expect(pageTwo.body.data.nextCursor).toBeNull();
    expect(forbiddenBranch.status).toBe(403);
    expect(forbiddenBranch.body.error.code).toBe("LOCATION_FORBIDDEN");
  });
});

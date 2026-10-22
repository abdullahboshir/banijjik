import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import {
  PAYMENT_METHOD,
  PAYMENT_REQUEST_TYPE,
  STORE_CREDIT_DIRECTION,
} from "@banijjik/contracts/payment";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createStylistResource,
  publishBookableService,
  SUNDAY_SCHEDULE,
} from "../../../../test-support/booking-api-world.js";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const SALON = { industryTemplateKey: "SALON" };

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

const money = (amount: number, currency = "BDT") => ({ amount, currency });

async function createCustomer(
  world: Awaited<ReturnType<typeof worldFor>>,
  name = "Customer",
): Promise<string> {
  const res = await world.alice.call("post", `/orgs/${world.organizationA}/contacts`, {
    contactType: "PERSON",
    name,
    phoneE164: `+880171${Math.floor(100000 + Math.random() * 900000)}`,
    contactRoles: ["CUSTOMER"],
  });
  expect(res.status).toBe(201);
  return (res.body.data as { contactId: string }).contactId;
}

async function createBooking(
  world: Awaited<ReturnType<typeof worldFor>>,
  contactId: string,
  startsAt = "2026-11-01T04:00:00.000Z",
): Promise<{
  bookingId: string;
  version: number;
  price: { total: { amount: number; currency: string } };
}> {
  const offering = await publishBookableService(world.alice, world.organizationA);
  const variantId = offering.variants[0]?.variantId;
  if (!variantId) throw new Error("missing variant");
  await createStylistResource(world.alice, world.organizationA, {
    locationId: world.locationA1,
    offeringId: offering.offeringId,
    name: `Stylist-${newId().slice(-4)}`,
    capacity: 2,
    weeklySchedule: SUNDAY_SCHEDULE,
  });

  const res = await world.alice.callWith({
    method: "post",
    path: `/orgs/${world.organizationA}/bookings`,
    idempotencyKey: newId(),
    body: {
      offeringId: offering.offeringId,
      variantId,
      locationId: world.locationA1,
      startsAt,
      contactId,
    },
  });
  expect(res.status).toBe(201);
  return res.body.data;
}

async function getApprovalToken(
  world: Awaited<ReturnType<typeof worldFor>>,
  input: {
    action: string;
    subjectKey: string;
    amount: { amount: number; currency: string };
    locationId: string;
  },
): Promise<string> {
  await world.alice.call("put", `/orgs/${world.organizationA}/me/approval-pin`, {
    currentPassword: world.alice.person.password,
    pin: "1234",
  });
  const approvers = await world.alice.call(
    "get",
    `/orgs/${world.organizationA}/approvers?locationId=${input.locationId}`,
  );
  const granted = await world.alice.call("post", `/orgs/${world.organizationA}/approvals`, {
    action: input.action,
    subjectKey: input.subjectKey,
    amount: input.amount,
    locationId: input.locationId,
    approverMemberId: approvers.body.data[0].memberId,
    pin: "1234",
  });
  expect(granted.status).toBe(200);
  return granted.body.data.approvalToken as string;
}

describe("payment concurrency", () => {
  it("two concurrent store-credit uses allow one winner and keep the balance >= 0", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);
    const booking1 = await createBooking(world, contactId, "2026-11-01T04:00:00.000Z");
    const booking2 = await createBooking(world, contactId, "2026-11-01T06:00:00.000Z");
    const creditAmount = booking1.price.total.amount;

    const approvalToken = await getApprovalToken(world, {
      action: APPROVAL_ACTION.STORE_CREDIT_ADJUSTMENT,
      subjectKey: contactId,
      amount: money(creditAmount),
      locationId: world.locationA1,
    });
    const adj = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/store-credit/adjustments`,
      idempotencyKey: newId(),
      body: {
        contactId,
        direction: STORE_CREDIT_DIRECTION.CREDIT,
        amount: money(creditAmount),
        reason: "Seed credit for concurrency test",
        approvalToken,
      },
    });
    expect(adj.status).toBe(201);

    const [res1, res2] = await Promise.all([
      world.alice.callWith({
        method: "post",
        path: `/orgs/${world.organizationA}/payments`,
        idempotencyKey: newId(),
        body: {
          locationId: world.locationA1,
          method: PAYMENT_METHOD.STORE_CREDIT,
          amount: money(creditAmount),
          contactId,
          allocations: [
            {
              requestType: PAYMENT_REQUEST_TYPE.BOOKING,
              requestId: booking1.bookingId,
              amount: money(creditAmount),
            },
          ],
        },
      }),
      world.alice.callWith({
        method: "post",
        path: `/orgs/${world.organizationA}/payments`,
        idempotencyKey: newId(),
        body: {
          locationId: world.locationA1,
          method: PAYMENT_METHOD.STORE_CREDIT,
          amount: money(creditAmount),
          contactId,
          allocations: [
            {
              requestType: PAYMENT_REQUEST_TYPE.BOOKING,
              requestId: booking2.bookingId,
              amount: money(creditAmount),
            },
          ],
        },
      }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses[0]).toBe(201);
    expect([409, 422]).toContain(statuses[1]);

    const contactRes = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/contacts/${contactId}`,
    );
    expect(contactRes.status).toBe(200);
    expect(contactRes.body.data.summary?.storeCreditBalanceMinor).toBe(0);
  });

  it("two concurrent refunds of the full paid amount allow exactly one to succeed", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);
    const booking = await createBooking(world, contactId);
    const total = booking.price.total.amount;

    const payRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(total),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking.bookingId,
            amount: money(total),
          },
        ],
      },
    });
    expect(payRes.status).toBe(201);

    const [ref1, ref2] = await Promise.all([
      world.alice.callWith({
        method: "post",
        path: `/orgs/${world.organizationA}/refunds`,
        idempotencyKey: newId(),
        body: {
          locationId: world.locationA1,
          method: PAYMENT_METHOD.CASH,
          amount: money(total),
          contactId,
          allocations: [
            {
              requestType: PAYMENT_REQUEST_TYPE.BOOKING,
              requestId: booking.bookingId,
              amount: money(total),
            },
          ],
        },
      }),
      world.alice.callWith({
        method: "post",
        path: `/orgs/${world.organizationA}/refunds`,
        idempotencyKey: newId(),
        body: {
          locationId: world.locationA1,
          method: PAYMENT_METHOD.CASH,
          amount: money(total),
          contactId,
          allocations: [
            {
              requestType: PAYMENT_REQUEST_TYPE.BOOKING,
              requestId: booking.bookingId,
              amount: money(total),
            },
          ],
        },
      }),
    ]);

    const statuses = [ref1.status, ref2.status].sort();
    expect(statuses[0]).toBe(201);
    expect([409, 422]).toContain(statuses[1]);
  });

  it("two concurrent payments that together exceed the booking total allow exactly one to succeed", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);
    const booking = await createBooking(world, contactId);
    const total = booking.price.total.amount;

    const [p1, p2] = await Promise.all([
      world.alice.callWith({
        method: "post",
        path: `/orgs/${world.organizationA}/payments`,
        idempotencyKey: newId(),
        body: {
          locationId: world.locationA1,
          method: PAYMENT_METHOD.CASH,
          amount: money(total),
          contactId,
          allocations: [
            {
              requestType: PAYMENT_REQUEST_TYPE.BOOKING,
              requestId: booking.bookingId,
              amount: money(total),
            },
          ],
        },
      }),
      world.alice.callWith({
        method: "post",
        path: `/orgs/${world.organizationA}/payments`,
        idempotencyKey: newId(),
        body: {
          locationId: world.locationA1,
          method: PAYMENT_METHOD.CASH,
          amount: money(total),
          contactId,
          allocations: [
            {
              requestType: PAYMENT_REQUEST_TYPE.BOOKING,
              requestId: booking.bookingId,
              amount: money(total),
            },
          ],
        },
      }),
    ]);

    const statuses = [p1.status, p2.status].sort();
    expect(statuses[0]).toBe(201);
    expect([400, 409]).toContain(statuses[1]);
  });

  it("two concurrent reversals with two valid tokens return one 201 and one 409", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);
    const booking = await createBooking(world, contactId);
    const total = booking.price.total.amount;

    const payRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(total),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking.bookingId,
            amount: money(total),
          },
        ],
      },
    });
    expect(payRes.status).toBe(201);
    const paymentId = payRes.body.data.paymentId as string;

    const token1 = await getApprovalToken(world, {
      action: APPROVAL_ACTION.PAYMENT_REVERSAL,
      subjectKey: paymentId,
      amount: money(total),
      locationId: world.locationA1,
    });
    const token2 = await getApprovalToken(world, {
      action: APPROVAL_ACTION.PAYMENT_REVERSAL,
      subjectKey: paymentId,
      amount: money(total),
      locationId: world.locationA1,
    });

    const [rev1, rev2] = await Promise.all([
      world.alice.callWith({
        method: "post",
        path: `/orgs/${world.organizationA}/payments/${paymentId}/reverse`,
        idempotencyKey: newId(),
        body: { approvalToken: token1 },
      }),
      world.alice.callWith({
        method: "post",
        path: `/orgs/${world.organizationA}/payments/${paymentId}/reverse`,
        idempotencyKey: newId(),
        body: { approvalToken: token2 },
      }),
    ]);

    const statuses = [rev1.status, rev2.status].sort();
    expect(statuses).toEqual([201, 409]);
  });
});

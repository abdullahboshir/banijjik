import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { BOOKING_EVENT_TYPE } from "@banijjik/contracts/booking";
import {
  PAYMENT_METHOD,
  PAYMENT_REQUEST_TYPE,
  PAYMENT_STATUS,
  STORE_CREDIT_DIRECTION,
} from "@banijjik/contracts/payment";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { models, MongoUnitOfWork } from "../../../../kernel/db/index.js";
import { runInOrganizationContext } from "../../../../kernel/tenancy/index.js";
import {
  bookingManifest,
  buildMarkNoShowsJob,
  MongoBookingRepository,
  MongoResourceSlotUsageRepository,
} from "../../booking/index.js";
import { buildBookingDepositCheckAdapter } from "../../../../routes/booking-deposit-adapter.js";
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
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";

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
  name = "Rahim SecretName",
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

async function createBookingAtLocation(
  world: Awaited<ReturnType<typeof worldFor>>,
  contactId: string,
  locationId: string,
  startsAt = "2026-11-01T04:00:00.000Z",
): Promise<{
  bookingId: string;
  version: number;
  status: string;
  price: { total: { amount: number; currency: string } };
}> {
  const offering = await publishBookableService(world.alice, world.organizationA);
  const variantId = offering.variants[0]?.variantId;
  if (!variantId) throw new Error("missing variant");
  await createStylistResource(world.alice, world.organizationA, {
    locationId,
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
      locationId,
      startsAt,
      contactId,
    },
  });
  expect(res.status).toBe(201);
  return res.body.data;
}

describe("dues lifecycle, deposit policy, events, permissions, cross-location, and ported finance rules", () => {
  it("transitions dues and paymentStatus through UNPAID -> PARTIAL -> PAID -> REFUNDED", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);
    const booking = await createBookingAtLocation(world, contactId, world.locationA1);
    const total = booking.price.total.amount;

    // 1. UNPAID immediately after booking creation
    const unpaidDues = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/dues?contactId=${contactId}&requestType=BOOKING`,
    );
    expect(unpaidDues.status).toBe(200);
    expect(unpaidDues.body.data).toHaveLength(1);
    expect(unpaidDues.body.data[0].paymentStatus).toBe(PAYMENT_STATUS.UNPAID);
    expect(unpaidDues.body.data[0].due.amount).toBe(total);

    // 2. PARTIAL after partial payment
    const partialPay = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(20000),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking.bookingId,
            amount: money(20000),
          },
        ],
      },
    });
    expect(partialPay.status).toBe(201);

    const partialDues = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/dues?contactId=${contactId}&requestType=BOOKING`,
    );
    expect(partialDues.body.data[0].paymentStatus).toBe(PAYMENT_STATUS.PARTIAL);
    expect(partialDues.body.data[0].due.amount).toBe(total - 20000);

    // 3. PAID after paying the remainder
    const restPay = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(total - 20000),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking.bookingId,
            amount: money(total - 20000),
          },
        ],
      },
    });
    expect(restPay.status).toBe(201);

    const paidDues = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/dues?contactId=${contactId}&requestType=BOOKING`,
    );
    expect(paidDues.body.data).toHaveLength(0);
    const paidBooking = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/bookings/${booking.bookingId}`,
    );
    expect(paidBooking.body.data.paymentStatus).toBe(PAYMENT_STATUS.PAID);

    // 4. REFUNDED after full refund
    const refundRes = await world.alice.callWith({
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
    });
    expect(refundRes.status).toBe(201);

    const refundedDues = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/dues?contactId=${contactId}&requestType=BOOKING`,
    );
    expect(refundedDues.body.data).toHaveLength(1);
    expect(refundedDues.body.data[0].paymentStatus).toBe(PAYMENT_STATUS.REFUNDED);
    expect(refundedDues.body.data[0].due.amount).toBe(total);
  });

  it("prevents auto-confirm on create when deposit is required, checks allocated - refunded on confirm, and applies deposit policy inside and outside the free cancel window", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [
        { settingKey: "booking.requireApproval", value: false },
        { settingKey: "booking.deposit.required", value: "FULL" },
        { settingKey: "booking.freeCancelHours", value: 24 },
        { settingKey: "booking.lateCancelFee", value: "DEPOSIT" },
      ],
    });

    const contactId = await createCustomer(world);

    // Even with requireApproval=false, a booking requiring a deposit starts as REQUESTED
    const farFutureSunday = "2027-03-07T04:00:00.000Z";
    const b1 = await createBookingAtLocation(world, contactId, world.locationA1, farFutureSunday);
    expect(b1.status).toBe("REQUESTED");
    const total1 = b1.price.total.amount;

    // Pay deposit, then refund part of it -> confirm must fail because allocated - refunded < depositRequired
    await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(total1),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: b1.bookingId,
            amount: money(total1),
          },
        ],
      },
    });
    await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/refunds`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(10000),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: b1.bookingId,
            amount: money(10000),
          },
        ],
      },
    });
    const failConfirmAfterRefund = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/bookings/${b1.bookingId}/confirm`,
      { version: b1.version },
    );
    expect(failConfirmAfterRefund.status).toBe(422);

    // Top up the refunded 10000 and confirm
    await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(10000),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: b1.bookingId,
            amount: money(10000),
          },
        ],
      },
    });
    const confirmed1 = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/bookings/${b1.bookingId}/confirm`,
      { version: b1.version },
    );
    expect(confirmed1.status).toBe(200);

    // Cancel b1 INSIDE the free window (2027-03-07 is months away > 24h) -> credits full deposit to store credit
    const cancelInside = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/bookings/${b1.bookingId}/cancel`,
      { version: confirmed1.body.data.version, reason: "Free window cancel" },
    );
    expect(cancelInside.status).toBe(200);
    expect(cancelInside.body.data.cancellationFeeRetained ?? null).toBeNull();

    const contactAfterFreeCancel = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/contacts/${contactId}`,
    );
    expect(contactAfterFreeCancel.body.data.summary?.storeCreditBalanceMinor).toBe(total1);

    // Now test cancel OUTSIDE the free window: set freeCancelHours very large (e.g. 100000) so startsAt is within the late-cancel window
    const patchFreeHours = await world.alice.call(
      "patch",
      `/orgs/${world.organizationA}/settings`,
      {
        items: [{ settingKey: "booking.freeCancelHours", value: 100000, version: 1 }],
      },
    );
    expect(patchFreeHours.status).toBe(200);
    const b2 = await createBookingAtLocation(
      world,
      contactId,
      world.locationA1,
      "2027-03-14T04:00:00.000Z",
    );
    const total2 = b2.price.total.amount;
    await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(total2),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: b2.bookingId,
            amount: money(total2),
          },
        ],
      },
    });
    const cancelOutside = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/bookings/${b2.bookingId}/cancel`,
      { version: b2.version, reason: "Late cancel" },
    );
    expect(cancelOutside.status).toBe(200);
    expect(cancelOutside.body.data.cancellationFeeRetained?.amount).toBe(total2);

    // Store credit balance did NOT increase from the late cancel
    const contactAfterLateCancel = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/contacts/${contactId}`,
    );
    expect(contactAfterLateCancel.body.data.summary?.storeCreditBalanceMinor).toBe(total1);
  });

  it("retains zero fee when feeMode is PERCENT and feePercent is 0 on late cancellation", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);

    // Set lateCancelFee to PERCENT, feePercent to 0, freeCancelHours large (outside window)
    const patchSettings = await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [
        { settingKey: "booking.freeCancelHours", value: 100000 },
        { settingKey: "booking.lateCancelFee", value: "PERCENT" },
        { settingKey: "booking.feePercent", value: 0 },
      ],
    });
    expect(patchSettings.status).toBe(200);

    const booking = await createBookingAtLocation(
      world,
      contactId,
      world.locationA1,
      "2027-03-14T04:00:00.000Z",
    );
    const total = booking.price.total.amount;

    await world.alice.callWith({
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

    const cancelRes = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/bookings/${booking.bookingId}/cancel`,
      { version: booking.version, reason: "Late cancel with 0 percent fee" },
    );
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.cancellationFeeRetained ?? null).toBeNull();

    // Since 0 fee was retained, the full amount was refunded to store credit
    const contact = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/contacts/${contactId}`,
    );
    expect(contact.body.data.summary?.storeCreditBalanceMinor).toBe(total);
  });

  it("publishes payment and store-credit events with paymentAccount:<organizationId> orderingKey and no personal data", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world, "SensitivePersonName");
    const booking = await createBookingAtLocation(world, contactId, world.locationA1);
    const total = booking.price.total.amount;

    const payRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(total + 5000),
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

    interface OutboxRow {
      readonly orderingKey: string | null;
      readonly payload: Record<string, unknown>;
    }
    const outboxModel = models({}).get<OutboxRow>("OutboxEvent");
    const events = await outboxModel
      .find({
        organizationId: world.organizationA,
        type: { $in: ["payment.payment.received", "payment.storeCredit.changed"] },
      })
      .lean<OutboxRow[]>();

    expect(events.length).toBeGreaterThanOrEqual(2);
    for (const ev of events) {
      expect(ev.orderingKey).toBe(`paymentAccount:${world.organizationA}`);
      const serialized = JSON.stringify(ev.payload);
      expect(serialized).not.toContain("SensitivePersonName");
      expect(serialized).not.toContain("+880171");
    }
  });

  it("enforces permissions (VIEWER cannot receive; CASHIER cannot reverse or adjust store credit) and cross-location isolation (STAFF at L1 cannot receive at L2 or see L2 dues)", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);
    const bookingL1 = await createBookingAtLocation(
      world,
      contactId,
      world.locationA1,
      "2026-11-01T04:00:00.000Z",
    );
    const bookingL2 = await createBookingAtLocation(
      world,
      contactId,
      world.locationA2,
      "2026-11-01T06:00:00.000Z",
    );

    const viewerRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.VIEWER,
    );
    const cashierRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.CASHIER,
    );
    const staffRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.STAFF,
    );

    const viewer = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: viewerRoleId },
    ]);
    const cashier = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: cashierRoleId },
    ]);
    const staffL1 = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: staffRoleId },
    ]);

    // VIEWER cannot receive payment -> 403
    const viewerReceive = await viewer.actor.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(10000),
        allocations: [],
      },
    });
    expect(viewerReceive.status).toBe(403);

    // CASHIER can receive at L1
    const cashierReceive = await cashier.actor.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(10000),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: bookingL1.bookingId,
            amount: money(10000),
          },
        ],
      },
    });
    expect(cashierReceive.status).toBe(201);
    const paymentId = cashierReceive.body.data.paymentId as string;

    // CASHIER cannot reverse payment -> 403
    const cashierReverse = await cashier.actor.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments/${paymentId}/reverse`,
      idempotencyKey: newId(),
      body: { approvalToken: "any-token" },
    });
    expect(cashierReverse.status).toBe(403);

    // CASHIER cannot adjust store credit -> 403
    const cashierAdjust = await cashier.actor.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/store-credit/adjustments`,
      idempotencyKey: newId(),
      body: {
        contactId,
        direction: STORE_CREDIT_DIRECTION.CREDIT,
        amount: money(5000),
        reason: "Not allowed",
        approvalToken: "any-token",
      },
    });
    expect(cashierAdjust.status).toBe(403);

    // STAFF at L1 receiving at L2 -> 403
    const staffReceiveL2 = await staffL1.actor.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA2,
        method: PAYMENT_METHOD.CASH,
        amount: money(10000),
        allocations: [],
      },
    });
    expect(staffReceiveL2.status).toBe(403);

    // Viewer at L1 sees only L1 dues, never L2 dues
    const l1Dues = await viewer.actor.call(
      "get",
      `/orgs/${world.organizationA}/dues?contactId=${contactId}`,
    );
    expect(l1Dues.status).toBe(200);
    const dueRequestIds = (l1Dues.body.data as { requestId: string }[]).map((d) => d.requestId);
    expect(dueRequestIds).toContain(bookingL1.bookingId);
    expect(dueRequestIds).not.toContain(bookingL2.bookingId);
  });

  it("ports manoxen finance rules: multi-request split allocation, sequential partial refunds, and refusal when refund exceeds remaining net paid", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);
    const b1 = await createBookingAtLocation(
      world,
      contactId,
      world.locationA1,
      "2026-11-01T04:00:00.000Z",
    );
    const b2 = await createBookingAtLocation(
      world,
      contactId,
      world.locationA1,
      "2026-11-01T06:00:00.000Z",
    );
    const t1 = b1.price.total.amount;
    const t2 = b2.price.total.amount;

    // Single payment splitting across two bookings + overpayment to store credit
    const splitPay = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.BKASH,
        externalReference: `BK-SPLIT-${newId().slice(-6)}`,
        amount: money(t1 + t2 + 7500),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: b1.bookingId,
            amount: money(t1),
          },
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: b2.bookingId,
            amount: money(t2),
          },
        ],
      },
    });
    expect(splitPay.status).toBe(201);

    // Sequential partial refunds on b1: first 20000, then exceeding remainder fails, then exact remainder succeeds
    const ref1 = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/refunds`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(20000),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: b1.bookingId,
            amount: money(20000),
          },
        ],
      },
    });
    expect(ref1.status).toBe(201);

    const overRef = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/refunds`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(t1 - 20000 + 1),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: b1.bookingId,
            amount: money(t1 - 20000 + 1),
          },
        ],
      },
    });
    expect(overRef.status).toBe(422);

    const restRef = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/refunds`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.STORE_CREDIT,
        amount: money(t1 - 20000),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: b1.bookingId,
            amount: money(t1 - 20000),
          },
        ],
      },
    });
    expect(restRef.status).toBe(201);

    const contactRes = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/contacts/${contactId}`,
    );
    expect(contactRes.body.data.summary?.storeCreditBalanceMinor).toBe(7500 + (t1 - 20000));
  });

  it("retains fee and writes the same event as the manual path on job-marked no-show; running the job twice settles nothing on the second run", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [
        { settingKey: "booking.requireApproval", value: false },
        { settingKey: "booking.deposit.required", value: "FULL" },
        { settingKey: "booking.noShowFee", value: "DEPOSIT" },
        { settingKey: "booking.noShowAfterMinutes", value: 30 },
      ],
    });

    const contactId = await createCustomer(world);
    const bookingDate = "2027-03-07T04:00:00.000Z";
    const b1 = await createBookingAtLocation(world, contactId, world.locationA1, bookingDate);
    expect(b1.status).toBe("REQUESTED");
    const depositAmount = b1.price.total.amount;

    // Pay full deposit
    const payRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(depositAmount),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: b1.bookingId,
            amount: money(depositAmount),
          },
        ],
      },
    });
    expect(payRes.status).toBe(201);

    // Confirm booking
    const confirmRes = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/bookings/${b1.bookingId}/confirm`,
      { version: b1.version },
    );
    expect(confirmRes.status).toBe(200);

    // Build the markNoShows job
    const publishedEvents: Array<{
      eventType: string;
      payload: unknown;
      options?: { orderingKey?: string };
    }> = [];
    const eventCollector = {
      publish: async (eventType: string, payload: unknown, options?: { orderingKey?: string }) => {
        publishedEvents.push(options ? { eventType, payload, options } : { eventType, payload });
      },
    };

    const job = buildMarkNoShowsJob({
      bookings: new MongoBookingRepository(),
      slots: new MongoResourceSlotUsageRepository(),
      unitOfWork: new MongoUnitOfWork(),
      events: eventCollector,
      orgConfig: {
        current: async () => ({
          modules: ["booking"],
          config: {
            settings: {
              "booking.noShowAfterMinutes": 30,
              "booking.noShowFee": "DEPOSIT",
              "booking.deposit.required": "FULL",
            },
          },
        }),
        forOrganization: async () => ({
          modules: ["booking"],
          config: {
            settings: {
              "booking.noShowAfterMinutes": 30,
              "booking.noShowFee": "DEPOSIT",
              "booking.deposit.required": "FULL",
            },
          },
        }),
      } as unknown as import("../../../platform/entitlement/index.js").OrgConfigService,
      manifests: [bookingManifest],
      depositCheck: buildBookingDepositCheckAdapter({ events: eventCollector }),
    });

    // Run job 1 hour after start (beyond 30 min grace)
    const runTime = new Date("2027-03-07T05:00:00.000Z");
    await runInOrganizationContext(world.organizationA, () =>
      job.run(world.organizationA, runTime),
    );

    // Verify booking is marked NO_SHOW and retained fee
    const getRes = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/bookings/${b1.bookingId}`,
    );
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.status).toBe("NO_SHOW");
    expect(getRes.body.data.cancellationFeeRetained?.amount).toBe(depositAmount);

    // Verify published event matches manual path
    const noShowEvent = publishedEvents.find(
      (e) => e.eventType === BOOKING_EVENT_TYPE.BOOKING_NO_SHOW_MARKED,
    );
    expect(noShowEvent).toBeDefined();
    expect(noShowEvent?.payload).toEqual({ bookingId: b1.bookingId });
    expect(noShowEvent?.options?.orderingKey).toBe(`booking:${b1.bookingId}`);

    // Clear events and run job second time
    publishedEvents.length = 0;
    await runInOrganizationContext(world.organizationA, () =>
      job.run(world.organizationA, runTime),
    );

    // Second run settles nothing
    expect(publishedEvents).toHaveLength(0);
  });
});

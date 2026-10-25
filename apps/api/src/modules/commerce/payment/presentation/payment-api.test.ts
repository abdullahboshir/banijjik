import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import {
  PAYMENT_DIRECTION,
  PAYMENT_METHOD,
  PAYMENT_REQUEST_TYPE,
  PAYMENT_STATUS,
  STORE_CREDIT_DIRECTION,
  STORE_CREDIT_ENTRY_KIND,
} from "@banijjik/contracts/payment";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { asId, newId, type LocationId } from "@banijjik/ids";
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
import { withOrganizationContext } from "../../../../test-support/organization-context.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import { buildPaymentPostingSourceAdapter, RequestReaderRegistry } from "../index.js";

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
    name: "Stylist 1",
    capacity: 1,
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
      startsAt: "2026-11-01T04:00:00.000Z",
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

describe("Payment API", () => {
  it("receives cash payment for a booking and updates dues to PAID", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);
    const booking = await createBooking(world, contactId);

    // Initial booking payment status is UNPAID
    const initialBooking = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/bookings/${booking.bookingId}`,
    );
    expect(initialBooking.status).toBe(200);
    expect(initialBooking.body.data.paymentStatus).toBe(PAYMENT_STATUS.UNPAID);

    // Pay partial 20000 in cash
    const partialPayRes = await world.alice.callWith({
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
    expect(partialPayRes.status).toBe(201);

    // Dues query after partial payment
    const partialDues = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/dues?contactId=${contactId}&requestType=BOOKING`,
    );
    expect(partialDues.status).toBe(200);
    expect(partialDues.body.data.length).toBe(1);
    expect(partialDues.body.data[0].due.amount).toBe(booking.price.total.amount - 20000);
    expect(partialDues.body.data[0].paymentStatus).toBe(PAYMENT_STATUS.PARTIAL);

    // Pay remaining amount
    const remainingAmount = booking.price.total.amount - 20000;
    const payRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(remainingAmount),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking.bookingId,
            amount: money(remainingAmount),
          },
        ],
      },
    });

    expect(payRes.status).toBe(201);
    const payment = payRes.body.data;
    expect(payment.paymentId).toBeDefined();
    expect(payment.direction).toBe(PAYMENT_DIRECTION.IN);
    expect(payment.method).toBe(PAYMENT_METHOD.CASH);
    expect(payment.amount.amount).toBe(remainingAmount);
    expect(payment.allocations[0].requestId).toBe(booking.bookingId);

    // Get payment by ID
    const getRes = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/payments/${payment.paymentId}`,
    );
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.paymentId).toBe(payment.paymentId);

    // Dues query after full payment should have 0 items (since due == 0)
    const afterDues = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/dues?contactId=${contactId}&requestType=BOOKING`,
    );
    expect(afterDues.status).toBe(200);
    expect(afterDues.body.data.length).toBe(0);

    // Booking read returns paymentStatus PAID
    const bookingRead = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/bookings/${booking.bookingId}`,
    );
    expect(bookingRead.status).toBe(200);
    expect(bookingRead.body.data.paymentStatus).toBe(PAYMENT_STATUS.PAID);
  });

  it("handles bKash payment with externalReference and enforces uniqueness", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);
    const booking = await createBooking(world, contactId);
    const externalReference = `BKASH-${Date.now()}`;

    const payRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.BKASH,
        externalReference,
        amount: money(booking.price.total.amount),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking.bookingId,
            amount: money(booking.price.total.amount),
          },
        ],
      },
    });
    expect(payRes.status).toBe(201);
    const firstPaymentId = payRes.body.data.paymentId;

    // Second payment with same external reference and method should fail with 409
    const dupRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.BKASH,
        externalReference,
        amount: money(1000),
        allocations: [],
      },
    });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error.code).toBe("CONFLICT");
    expect(dupRes.body.error.details.existingPaymentId).toBe(firstPaymentId);
  });

  it("credits overpayment to store credit when contact is provided", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);
    const booking = await createBooking(world, contactId);

    const overpaymentAmount = 10000;
    const totalPaid = booking.price.total.amount + overpaymentAmount;

    const payRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.BKASH,
        externalReference: `BK-${Date.now()}`,
        amount: money(totalPaid),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking.bookingId,
            amount: money(booking.price.total.amount),
          },
        ],
      },
    });
    expect(payRes.status).toBe(201);

    // Contact summary has store credit balance
    const contactRes = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/contacts/${contactId}`,
    );
    expect(contactRes.status).toBe(200);
    expect(contactRes.body.data.summary?.storeCreditBalanceMinor).toBe(overpaymentAmount);

    // Store credit entries list
    const entriesRes = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/store-credit?contactId=${contactId}`,
    );
    expect(entriesRes.status).toBe(200);
    expect(entriesRes.body.data.length).toBe(1);
    expect(entriesRes.body.data[0].amount.amount).toBe(overpaymentAmount);
    expect(entriesRes.body.data[0].kind).toBe(STORE_CREDIT_ENTRY_KIND.PAYMENT_OVERPAYMENT);
  });

  it("handles cash change without storing credit when contact is omitted", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);
    const booking = await createBooking(world, contactId);

    const payRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(booking.price.total.amount + 5000), // Paid extra in cash
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking.bookingId,
            amount: money(booking.price.total.amount),
          },
        ],
      },
    });
    expect(payRes.status).toBe(201);
  });

  it("refuses overpayment on non-cash methods when contact is omitted", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);
    const booking = await createBooking(world, contactId);

    const payRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.BKASH,
        externalReference: "BK-REF-123",
        amount: money(booking.price.total.amount + 5000),
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking.bookingId,
            amount: money(booking.price.total.amount),
          },
        ],
      },
    });
    expect(payRes.status).toBe(422);
    expect(payRes.body.error.code).toBe("BUSINESS_RULE");
  });

  it("replays idempotency key returning identical payment response, or 422 on modified payload", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);
    const booking = await createBooking(world, contactId);
    const key = newId();

    const body = {
      locationId: world.locationA1,
      method: PAYMENT_METHOD.CASH,
      amount: money(booking.price.total.amount),
      contactId,
      allocations: [
        {
          requestType: PAYMENT_REQUEST_TYPE.BOOKING,
          requestId: booking.bookingId,
          amount: money(booking.price.total.amount),
        },
      ],
    };

    const first = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: key,
      body,
    });
    expect(first.status).toBe(201);

    // Replay identical
    const second = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: key,
      body,
    });
    expect(second.status).toBe(201);
    expect(second.body.data.paymentId).toBe(first.body.data.paymentId);

    // Modified payload -> 422 IDEMPOTENCY_MISMATCH
    const modified = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: key,
      body: { ...body, amount: money(999999) },
    });
    expect(modified.status).toBe(422);
    expect(modified.body.error.code).toBe("IDEMPOTENCY_MISMATCH");
  });

  it("executes partial refund with manager and requires approval for cashier", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);
    const booking = await createBooking(world, contactId);

    // Create a cashier member
    const cashierRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.CASHIER,
    );
    const cashier = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: cashierRoleId },
    ]);
    const cashierActor = cashier.actor;

    // Pay full
    const payRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(booking.price.total.amount),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking.bookingId,
            amount: money(booking.price.total.amount),
          },
        ],
      },
    });
    expect(payRes.status).toBe(201);

    // Cashier without refund permission gets 403
    const cashierRefundNoPerm = await cashierActor.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/refunds`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(10000),
        note: "Customer dissatisfaction",
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking.bookingId,
            amount: money(10000),
          },
        ],
      },
    });
    expect(cashierRefundNoPerm.status).toBe(403);

    // Owner (Alice) refunds 10000 without approval token (since owner/manager setting allows it)
    const ownerRefund = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/refunds`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(10000),
        note: "Manager courtesy",
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking.bookingId,
            amount: money(10000),
          },
        ],
      },
    });
    expect(ownerRefund.status).toBe(201);
    expect(ownerRefund.body.data.direction).toBe(PAYMENT_DIRECTION.REFUND);

    // Booking status after partial refund should be PARTIAL (since 40000 out of 50000 paid)
    const bookingAfterRefund = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/bookings/${booking.bookingId}`,
    );
    expect(bookingAfterRefund.status).toBe(200);
    expect(bookingAfterRefund.body.data.paymentStatus).toBe(PAYMENT_STATUS.PARTIAL);

    // Dues query now shows 10000 due
    const duesAfterRefund = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/dues?contactId=${contactId}&requestType=BOOKING`,
    );
    expect(duesAfterRefund.status).toBe(200);
    expect(duesAfterRefund.body.data[0].due.amount).toBe(10000);
  });

  it("reverses a payment with approval token, mirrors allocations, and forbids double reversal", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);
    const booking = await createBooking(world, contactId);

    const payRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(booking.price.total.amount),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking.bookingId,
            amount: money(booking.price.total.amount),
          },
        ],
      },
    });
    expect(payRes.status).toBe(201);
    const payment = payRes.body.data;

    // Attempt reversal with invalid approval token
    const failReverse = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments/${payment.paymentId}/reverse`,
      idempotencyKey: newId(),
      body: { approvalToken: "invalid-token" },
    });
    expect(failReverse.status).toBe(403);

    // Get approval token for PAYMENT_REVERSAL
    const approvalToken = await getApprovalToken(world, {
      action: APPROVAL_ACTION.PAYMENT_REVERSAL,
      subjectKey: payment.paymentId,
      amount: payment.amount,
      locationId: world.locationA1,
    });

    // Reversal with valid approval token succeeds
    const reverseRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments/${payment.paymentId}/reverse`,
      idempotencyKey: newId(),
      body: { approvalToken },
    });
    expect(reverseRes.status).toBe(201);
    const reversed = reverseRes.body.data;
    expect(reversed.direction).toBe(PAYMENT_DIRECTION.REVERSAL);
    expect(reversed.reversesPaymentId).toBe(payment.paymentId);

    // Second reversal attempt fails with 409
    const secondApprovalToken = await getApprovalToken(world, {
      action: APPROVAL_ACTION.PAYMENT_REVERSAL,
      subjectKey: payment.paymentId,
      amount: payment.amount,
      locationId: world.locationA1,
    });
    const doubleReverse = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments/${payment.paymentId}/reverse`,
      idempotencyKey: newId(),
      body: { approvalToken: secondApprovalToken },
    });
    expect(doubleReverse.status).toBe(409);
    expect(doubleReverse.body.error.code).toBe("CONFLICT");

    // Dues query restores full amount as UNPAID
    const duesAfterReverse = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/dues?contactId=${contactId}&requestType=BOOKING`,
    );
    expect(duesAfterReverse.status).toBe(200);
    expect(duesAfterReverse.body.data[0].due.amount).toBe(booking.price.total.amount);
    expect(duesAfterReverse.body.data[0].paymentStatus).toBe(PAYMENT_STATUS.UNPAID);
  });

  it("adjusts store credit with approval token and verifies balance", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);

    // Initial store credit balance is 0
    const contactRes = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/contacts/${contactId}`,
    );
    expect(contactRes.body.data.summary?.storeCreditBalanceMinor ?? 0).toBe(0);

    const adjustAmount = money(5000);
    const approvalToken = await getApprovalToken(world, {
      action: APPROVAL_ACTION.STORE_CREDIT_ADJUSTMENT,
      subjectKey: contactId,
      amount: adjustAmount,
      locationId: world.locationA1,
    });

    const adjustRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/store-credit/adjustments`,
      idempotencyKey: newId(),
      body: {
        contactId,
        direction: STORE_CREDIT_DIRECTION.CREDIT,
        amount: adjustAmount,
        reason: "Customer goodwill compensation",
        approvalToken,
      },
    });
    expect(adjustRes.status).toBe(201);
    expect(adjustRes.body.data.balanceAfterMinor).toBe(5000);

    // Check contact updated
    const afterContact = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/contacts/${contactId}`,
    );
    expect(afterContact.body.data.summary?.storeCreditBalanceMinor).toBe(5000);
  });

  it("enforces deposit before booking confirmation", async () => {
    const world = await worldFor(harness, RETAIL, SALON);

    // Enable requireApproval and FULL deposit requirement for bookings
    const settingsPatch = await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [
        { settingKey: "booking.requireApproval", value: true },
        { settingKey: "booking.deposit.required", value: "FULL" },
      ],
    });
    expect(settingsPatch.status).toBe(200);

    const contactId = await createCustomer(world);
    const booking = await createBooking(world, contactId);

    // Confirm booking without payment -> 422 DEPOSIT_REQUIRED
    const failConfirm = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/bookings/${booking.bookingId}/confirm`,
      { version: booking.version },
    );
    expect(failConfirm.status).toBe(422);
    expect(failConfirm.body.error.code).toBe("BUSINESS_RULE");

    // Receive full deposit payment
    const payRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(booking.price.total.amount),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking.bookingId,
            amount: money(booking.price.total.amount),
          },
        ],
      },
    });
    expect(payRes.status).toBe(201);

    // Now confirm booking succeeds
    const confirmRes = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/bookings/${booking.bookingId}/confirm`,
      { version: booking.version },
    );
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe("CONFIRMED");
  });

  it("enforces cross-organization isolation", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);
    const booking = await createBooking(world, contactId);

    // Pay by Alice in Org A
    const payRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(booking.price.total.amount),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking.bookingId,
            amount: money(booking.price.total.amount),
          },
        ],
      },
    });
    expect(payRes.status).toBe(201);
    const paymentId = payRes.body.data.paymentId;

    // Bob (in Org B) cannot access Alice's payment
    const bobAccess = await world.bob.call(
      "get",
      `/orgs/${world.organizationB}/payments/${paymentId}`,
    );
    expect(bobAccess.status).toBe(404);

    // Bob cannot allocate a payment to Alice's booking
    const bobPay = await world.bob.callWith({
      method: "post",
      path: `/orgs/${world.organizationB}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationB1,
        method: PAYMENT_METHOD.CASH,
        amount: money(1000),
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking.bookingId,
            amount: money(1000),
          },
        ],
      },
    });
    expect(bobPay.status).toBe(400);
  });

  it("produces valid posting snapshots through accounting adapter", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);
    const booking = await createBooking(world, contactId);

    const payRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.BKASH,
        externalReference: `BK-${Date.now()}`,
        amount: money(booking.price.total.amount + 5000),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking.bookingId,
            amount: money(booking.price.total.amount),
          },
        ],
      },
    });
    expect(payRes.status).toBe(201);
    const payment = payRes.body.data;

    const requestReaders = new RequestReaderRegistry();
    requestReaders.register(PAYMENT_REQUEST_TYPE.BOOKING, {
      async read() {
        return {
          requestId: booking.bookingId,
          requestType: PAYMENT_REQUEST_TYPE.BOOKING,
          total: { amount: booking.price.total.amount, currency: "BDT" as const },
          revenueState: "BEFORE_REVENUE",
          contactId,
          locationId: asId<LocationId>(world.locationA1),
          acceptsPayments: true,
          refundLimit: null,
        };
      },
    });

    const adapter = buildPaymentPostingSourceAdapter(requestReaders);
    const snapshot = await withOrganizationContext(world.organizationA, () =>
      adapter.readPayment(payment.paymentId),
    );
    expect(snapshot).toBeDefined();
    expect(snapshot?.paymentId).toBe(payment.paymentId);
    expect(snapshot?.method).toBe("BKASH");
    expect(snapshot?.direction).toBe("IN");
    expect(snapshot?.overpaymentToStoreCredit?.amount).toBe(5000);
    expect(snapshot?.allocations[0]?.revenueState).toBe("BEFORE_REVENUE");
  });

  it("computes business date from organization timezone when timezone is non-Dhaka and clock is after local midnight", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);
    const booking = await createBooking(world, contactId);

    // Update organization A's timezone to Pacific/Auckland
    await harness.connections.platform
      .collection("organizations")
      .updateOne(
        { organizationId: world.organizationA },
        { $set: { timezone: "Pacific/Auckland" } },
      );

    // At 2026-10-22T11:15:00Z, Auckland is at UTC+13 (00:15 local time on 2026-10-23, just after midnight).
    // Asia/Dhaka is at UTC+6 (17:15 on 2026-10-22).
    const targetTime = new Date("2026-10-22T11:15:00.000Z");
    const deltaSeconds = (targetTime.getTime() - harness.clock.now().getTime()) / 1000;
    harness.clock.advanceSeconds(deltaSeconds);

    const payRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(booking.price.total.amount),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking.bookingId,
            amount: money(booking.price.total.amount),
          },
        ],
      },
    });

    expect(payRes.status).toBe(201);
    expect(payRes.body.data.businessDate).toBe("2026-10-23");
  });
});

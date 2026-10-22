import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import {
  PAYMENT_METHOD,
  PAYMENT_REQUEST_TYPE,
  STORE_CREDIT_DIRECTION,
  STORE_CREDIT_ENTRY_KIND,
} from "@banijjik/contracts/payment";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoUnitOfWork } from "../../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../../kernel/events/index.js";
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
import {
  buildExpireStoreCreditJob,
  MongoContactStoreCreditAdapter,
  MongoStoreCreditRepository,
} from "../index.js";

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

describe("store credit ledger, expiry job, and reversal rules", () => {
  it("writes a PAYMENT_USE debit entry with paymentId when paying by STORE_CREDIT so sum of entries equals balance", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);
    const booking1 = await createBooking(world, contactId, "2026-11-01T04:00:00.000Z");
    const booking2 = await createBooking(world, contactId, "2026-11-01T06:00:00.000Z");
    const total1 = booking1.price.total.amount;
    const overpayment = 30000;

    // 1. Overpay on booking1 to generate store credit
    const overpayRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(total1 + overpayment),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking1.bookingId,
            amount: money(total1),
          },
        ],
      },
    });
    expect(overpayRes.status).toBe(201);

    // 2. Spend 20000 of store credit on booking2
    const spendRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.STORE_CREDIT,
        amount: money(20000),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking2.bookingId,
            amount: money(20000),
          },
        ],
      },
    });
    expect(spendRes.status).toBe(201);
    const spendPaymentId = spendRes.body.data.paymentId as string;

    const entriesRes = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/store-credit?contactId=${contactId}`,
    );
    expect(entriesRes.status).toBe(200);
    const entries = entriesRes.body.data as {
      kind: string;
      direction: string;
      amount: { amount: number };
      paymentId: string | null;
    }[];
    expect(entries).toHaveLength(2);
    const useEntry = entries.find((e) => e.kind === STORE_CREDIT_ENTRY_KIND.PAYMENT_USE);
    expect(useEntry).toBeDefined();
    expect(useEntry?.direction).toBe(STORE_CREDIT_DIRECTION.DEBIT);
    expect(useEntry?.amount.amount).toBe(20000);
    expect(useEntry?.paymentId).toBe(spendPaymentId);

    const signedSum = entries.reduce(
      (sum, e) =>
        sum + (e.direction === STORE_CREDIT_DIRECTION.CREDIT ? e.amount.amount : -e.amount.amount),
      0,
    );
    const contactRes = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/contacts/${contactId}`,
    );
    expect(contactRes.body.data.summary?.storeCreditBalanceMinor).toBe(10000);
    expect(signedSum).toBe(10000);
  });

  it("rejects an unknown contactId on payment or refund with 400", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const unknownContactId = newId();

    const payRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(10000),
        contactId: unknownContactId,
        allocations: [],
      },
    });
    expect(payRes.status).toBe(400);
  });

  it("reverses a STORE_CREDIT payment by restoring credit, and claws back overpayment credit or refuses with 422 if spent", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);
    const booking1 = await createBooking(world, contactId, "2026-11-01T04:00:00.000Z");
    const booking2 = await createBooking(world, contactId, "2026-11-01T06:00:00.000Z");
    const total1 = booking1.price.total.amount;

    // Pay booking1 with 20000 overpayment
    const overpayRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(total1 + 20000),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking1.bookingId,
            amount: money(total1),
          },
        ],
      },
    });
    expect(overpayRes.status).toBe(201);
    const overpayPaymentId = overpayRes.body.data.paymentId as string;

    // Spend the 20000 store credit on booking2
    const spendRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.STORE_CREDIT,
        amount: money(20000),
        contactId,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: booking2.bookingId,
            amount: money(20000),
          },
        ],
      },
    });
    expect(spendRes.status).toBe(201);
    const spendPaymentId = spendRes.body.data.paymentId as string;

    // Attempting to reverse the overpayment while the credit is spent -> 422
    const token1 = await getApprovalToken(world, {
      action: APPROVAL_ACTION.PAYMENT_REVERSAL,
      subjectKey: overpayPaymentId,
      amount: money(total1 + 20000),
      locationId: world.locationA1,
    });
    const refusedReverse = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments/${overpayPaymentId}/reverse`,
      idempotencyKey: newId(),
      body: { approvalToken: token1 },
    });
    expect(refusedReverse.status).toBe(422);

    // Reverse the STORE_CREDIT spend first -> restores the 20000 credit
    const token2 = await getApprovalToken(world, {
      action: APPROVAL_ACTION.PAYMENT_REVERSAL,
      subjectKey: spendPaymentId,
      amount: money(20000),
      locationId: world.locationA1,
    });
    const revSpend = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments/${spendPaymentId}/reverse`,
      idempotencyKey: newId(),
      body: { approvalToken: token2 },
    });
    expect(revSpend.status).toBe(201);

    // Now reversing the overpayment succeeds and claws back the 20000 credit -> balance 0
    const token3 = await getApprovalToken(world, {
      action: APPROVAL_ACTION.PAYMENT_REVERSAL,
      subjectKey: overpayPaymentId,
      amount: money(total1 + 20000),
      locationId: world.locationA1,
    });
    const revOverpay = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments/${overpayPaymentId}/reverse`,
      idempotencyKey: newId(),
      body: { approvalToken: token3 },
    });
    expect(revOverpay.status).toBe(201);
    expect(revOverpay.body.data.approval?.approvalId).toBeDefined();
    expect(revOverpay.body.data.approval?.approvalId).not.toBe(token3.slice(0, 16));
    expect(token3.startsWith(revOverpay.body.data.approval?.approvalId)).toBe(false);

    const contactRes = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/contacts/${contactId}`,
    );
    expect(contactRes.body.data.summary?.storeCreditBalanceMinor).toBe(0);
  });

  it("refuses with 422 to reverse a payment whose allocated request was refunded afterwards", async () => {
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

    // Refund 10000 on the booking
    const refRes = await world.alice.callWith({
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
            requestId: booking.bookingId,
            amount: money(10000),
          },
        ],
      },
    });
    expect(refRes.status).toBe(201);

    // Reversing the payment now fails with 422
    const token = await getApprovalToken(world, {
      action: APPROVAL_ACTION.PAYMENT_REVERSAL,
      subjectKey: paymentId,
      amount: money(total),
      locationId: world.locationA1,
    });
    const revRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments/${paymentId}/reverse`,
      idempotencyKey: newId(),
      body: { approvalToken: token },
    });
    expect(revRes.status).toBe(422);
  });

  it("sets expiresAt on credit entries when storeCreditExpiryDays is configured and expires store credit only once when the expiry job runs twice", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);

    await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [{ settingKey: "payment.storeCreditExpiryDays", value: 1 }],
    });

    const bearerToken = await getApprovalToken(world, {
      action: APPROVAL_ACTION.STORE_CREDIT_ADJUSTMENT,
      subjectKey: contactId,
      amount: money(15000),
      locationId: world.locationA1,
    });
    const adjustRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/store-credit/adjustments`,
      idempotencyKey: newId(),
      body: {
        contactId,
        direction: STORE_CREDIT_DIRECTION.CREDIT,
        amount: money(15000),
        reason: "Expiring promo credit",
        approvalToken: bearerToken,
      },
    });
    expect(adjustRes.status).toBe(201);
    const createdEntry = adjustRes.body.data;
    expect(createdEntry.expiresAt).not.toBeNull();

    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const job = buildExpireStoreCreditJob({
      storeCredit: new MongoStoreCreditRepository(),
      contactStoreCredit: new MongoContactStoreCreditAdapter(),
      unitOfWork: new MongoUnitOfWork(),
      events: kernelEventPublisher,
      clock: { now: () => futureDate },
    });

    await withOrganizationContext(world.organizationA, async () => {
      await job.run(world.organizationA, futureDate);
      await job.run(world.organizationA, futureDate);
    });

    const entriesRes = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/store-credit?contactId=${contactId}`,
    );
    expect(entriesRes.status).toBe(200);
    const expiryEntries = (
      entriesRes.body.data as { kind: string; expiresStoreCreditEntryId?: string }[]
    ).filter((e) => e.kind === STORE_CREDIT_ENTRY_KIND.EXPIRY);
    expect(expiryEntries).toHaveLength(1);
    expect(expiryEntries[0]?.expiresStoreCreditEntryId).toBe(createdEntry.storeCreditEntryId);

    const contactRes = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/contacts/${contactId}`,
    );
    expect(contactRes.body.data.summary?.storeCreditBalanceMinor).toBe(0);
  });
});

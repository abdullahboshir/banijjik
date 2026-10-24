import { EVENT_TYPE, SYSTEM_ROLE_KEY, type EventEnvelope } from "@banijjik/contracts";
import {
  JOURNAL_SOURCE_TYPE,
  POSTING_KEY,
  SYSTEM_ACCOUNT_CODE,
} from "@banijjik/contracts/accounting";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import {
  CLOSED_REQUEST_REVERSAL_POLICY,
  PAYMENT_METHOD,
  PAYMENT_REQUEST_TYPE,
  PAYMENT_REVERSAL_CLOSED_REQUEST_SETTING_KEY,
} from "@banijjik/contracts/payment";
import { asId, newId, type OrganizationId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoUnitOfWork } from "../../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../../kernel/events/index.js";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import {
  createStylistResource,
  publishBookableService,
  SUNDAY_SCHEDULE,
} from "../../../../test-support/booking-api-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { withOrganizationContext } from "../../../../test-support/organization-context.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import { systemClock } from "../../../../kernel/time/index.js";
import { buildBookingRequestReader } from "../../../../routes/booking-request-reader.js";
import {
  buildPostBookingsHandler,
  buildPostPaymentsHandler,
  MongoAccountRepository,
  MongoJournalRepository,
  seedSystemAccounts,
} from "../../accounting/index.js";
import { buildBookingPostingSourceAdapter } from "../../booking/index.js";
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

type World = Awaited<ReturnType<typeof worldFor>>;

const money = (amount: number, currency = "BDT") => ({ amount, currency });

async function createCustomer(world: World): Promise<string> {
  const res = await world.alice.call("post", `/orgs/${world.organizationA}/contacts`, {
    contactType: "PERSON",
    name: "Customer",
    phoneE164: `+880171${Math.floor(100000 + Math.random() * 900000)}`,
    contactRoles: ["CUSTOMER"],
  });
  expect(res.status).toBe(201);
  return (res.body.data as { contactId: string }).contactId;
}

async function createBooking(
  world: World,
  contactId: string,
): Promise<{ bookingId: string; version: number; total: number }> {
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
      startsAt: "2027-03-14T04:00:00.000Z",
      contactId,
    },
  });
  expect(res.status).toBe(201);
  const data = res.body.data as {
    bookingId: string;
    version: number;
    price: { total: { amount: number } };
  };
  return { bookingId: data.bookingId, version: data.version, total: data.price.total.amount };
}

async function setPolicy(world: World, value: string): Promise<void> {
  const res = await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
    items: [{ settingKey: PAYMENT_REVERSAL_CLOSED_REQUEST_SETTING_KEY, value }],
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
}

async function makeLateCancelsKeepTheFee(world: World): Promise<void> {
  const res = await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
    items: [
      { settingKey: "booking.freeCancelHours", value: 100000 },
      { settingKey: "booking.lateCancelFee", value: "DEPOSIT" },
    ],
  });
  expect(res.status).toBe(200);
}

async function payBooking(world: World, contactId: string, bookingId: string, amount: number) {
  const res = await world.alice.callWith({
    method: "post",
    path: `/orgs/${world.organizationA}/payments`,
    idempotencyKey: newId(),
    body: {
      locationId: world.locationA1,
      method: PAYMENT_METHOD.CASH,
      amount: money(amount),
      contactId,
      allocations: [
        { requestType: PAYMENT_REQUEST_TYPE.BOOKING, requestId: bookingId, amount: money(amount) },
      ],
    },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data as { paymentId: string };
}

async function cancelBooking(world: World, booking: { bookingId: string; version: number }) {
  const res = await world.alice.call(
    "post",
    `/orgs/${world.organizationA}/bookings/${booking.bookingId}/cancel`,
    { version: booking.version, reason: "Customer cancelled" },
  );
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.data as { cancellationFeeRetained?: { amount: number } | null };
}

async function approvalTokenFor(world: World, paymentId: string, amount: number): Promise<string> {
  await world.alice.call("put", `/orgs/${world.organizationA}/me/approval-pin`, {
    currentPassword: world.alice.person.password,
    pin: "1234",
  });
  const approvers = await world.alice.call(
    "get",
    `/orgs/${world.organizationA}/approvers?locationId=${world.locationA1}`,
  );
  const granted = await world.alice.call("post", `/orgs/${world.organizationA}/approvals`, {
    action: APPROVAL_ACTION.PAYMENT_REVERSAL,
    subjectKey: paymentId,
    amount: money(amount),
    locationId: world.locationA1,
    approverMemberId: approvers.body.data[0].memberId,
    pin: "1234",
  });
  expect(granted.status).toBe(200);
  return granted.body.data.approvalToken as string;
}

async function reverse(world: World, paymentId: string, amount: number) {
  return world.alice.callWith({
    method: "post",
    path: `/orgs/${world.organizationA}/payments/${paymentId}/reverse`,
    idempotencyKey: newId(),
    body: { approvalToken: await approvalTokenFor(world, paymentId, amount) },
  });
}

async function bookingDues(world: World, contactId: string) {
  const res = await world.alice.call(
    "get",
    `/orgs/${world.organizationA}/dues?contactId=${contactId}&requestType=BOOKING`,
  );
  expect(res.status).toBe(200);
  return res.body.data as { requestId: string; due: { amount: number } }[];
}

async function balanceOf(world: World, accountCode: string): Promise<number> {
  const res = await world.alice.call(
    "get",
    `/orgs/${world.organizationA}/accounting/trial-balance?asOf=2099-12-31`,
  );
  expect(res.status).toBe(200);
  const rows = res.body.data.accounts as { accountCode: string; balance: { amount: number } }[];
  const row = rows.find((candidate) => candidate.accountCode === accountCode);
  if (!row) throw new Error(`missing account ${accountCode}`);
  return row.balance.amount;
}

/** The accounting side, run by hand: the same handlers the event worker would run. */
async function accountingFor(world: World) {
  const accounts = new MongoAccountRepository();
  const journals = new MongoJournalRepository();
  await withOrganizationContext(world.organizationA, () =>
    seedSystemAccounts(
      { accounts, clock: systemClock },
      { organizationId: asId<OrganizationId>(world.organizationA), actorUserId: null },
    ),
  );
  const readers = new RequestReaderRegistry();
  readers.register(PAYMENT_REQUEST_TYPE.BOOKING, buildBookingRequestReader());
  const posting = {
    accounts,
    journals,
    events: kernelEventPublisher,
    audit: { record: async () => undefined },
    clock: systemClock,
  };
  const paymentHandler = buildPostPaymentsHandler({
    payments: buildPaymentPostingSourceAdapter(readers),
    posting,
  });
  const bookingHandler = buildPostBookingsHandler({
    bookings: buildBookingPostingSourceAdapter(),
    posting,
  });
  const uow = new MongoUnitOfWork();
  const envelope = (type: string, payload: object): EventEnvelope<never> =>
    ({
      eventId: newId(),
      type,
      version: 1,
      occurredAt: new Date().toISOString(),
      organizationId: world.organizationA,
      actorUserId: null,
      payload,
    }) as unknown as EventEnvelope<never>;
  const run = (work: () => Promise<void>) =>
    withOrganizationContext(world.organizationA, () => uow.run(work));
  return {
    journals,
    paymentReceived: (paymentId: string) =>
      run(() => paymentHandler.handle(envelope(EVENT_TYPE.PAYMENT_RECEIVED, { paymentId }))),
    paymentReversed: (paymentId: string) =>
      run(() => paymentHandler.handle(envelope(EVENT_TYPE.PAYMENT_REVERSED, { paymentId }))),
    bookingCancelled: (bookingId: string) =>
      run(() => bookingHandler.handle(envelope(EVENT_TYPE.BOOKING_CANCELLED, { bookingId }))),
    badDebtJournals: async (paymentId: string) => {
      const page = await withOrganizationContext(world.organizationA, () =>
        journals.list({ page: 1, limit: 100 }),
      );
      return page.items.filter(
        (entry) =>
          entry.sourceType === JOURNAL_SOURCE_TYPE.PAYMENT &&
          entry.sourceId === paymentId &&
          entry.postingKey === POSTING_KEY.bad_debt_written_off,
      );
    },
  };
}

/** A booking paid in full, then cancelled late: the cancellation keeps the whole payment as the fee. */
async function cancelledBookingWithFeePaid(world: World) {
  const contactId = await createCustomer(world);
  await makeLateCancelsKeepTheFee(world);
  const booking = await createBooking(world, contactId);
  const payment = await payBooking(world, contactId, booking.bookingId, booking.total);
  const cancelled = await cancelBooking(world, booking);
  expect(cancelled.cancellationFeeRetained?.amount).toBe(booking.total);
  return { contactId, booking, payment, fee: booking.total };
}

describe("a payment reversed after its request was closed (booking)", () => {
  it("default REOPEN_DUE, booking: the retained fee is owed again, the books keep the fee income and a receivable, and a new payment clears both", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const { contactId, booking, payment, fee } = await cancelledBookingWithFeePaid(world);
    const accounting = await accountingFor(world);
    await accounting.paymentReceived(payment.paymentId);
    await accounting.bookingCancelled(booking.bookingId);
    expect(await bookingDues(world, contactId)).toEqual([]);

    const reversed = await reverse(world, payment.paymentId, fee);
    expect(reversed.status, JSON.stringify(reversed.body)).toBe(201);
    expect(reversed.body.data.writeOffs).toEqual([]);
    await accounting.paymentReversed(reversed.body.data.paymentId);

    const dues = await bookingDues(world, contactId);
    expect(dues).toHaveLength(1);
    expect(dues[0]).toMatchObject({ requestId: booking.bookingId, due: { amount: fee } });
    expect(await balanceOf(world, SYSTEM_ACCOUNT_CODE.CANCELLATION_FEE_INCOME)).toBe(fee);
    expect(await balanceOf(world, SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES)).toBe(-fee);
    expect(await accounting.badDebtJournals(reversed.body.data.paymentId)).toHaveLength(0);

    const again = await payBooking(world, contactId, booking.bookingId, fee);
    await accounting.paymentReceived(again.paymentId);
    expect(await bookingDues(world, contactId)).toEqual([]);
    expect(await balanceOf(world, SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES)).toBe(0);
  });

  it("WRITE_OFF, booking: the booking leaves dues, the reversal records the fee, bad debt is posted and the advances balance returns to zero", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    await setPolicy(world, CLOSED_REQUEST_REVERSAL_POLICY.WRITE_OFF);
    const { contactId, booking, payment, fee } = await cancelledBookingWithFeePaid(world);
    const accounting = await accountingFor(world);
    await accounting.paymentReceived(payment.paymentId);
    await accounting.bookingCancelled(booking.bookingId);

    const reversed = await reverse(world, payment.paymentId, fee);
    expect(reversed.status, JSON.stringify(reversed.body)).toBe(201);
    const reversalId = reversed.body.data.paymentId as string;
    expect(reversed.body.data.writeOffs).toEqual([
      {
        requestType: PAYMENT_REQUEST_TYPE.BOOKING,
        requestId: booking.bookingId,
        amount: money(fee),
      },
    ]);
    expect(await bookingDues(world, contactId)).toEqual([]);

    await accounting.paymentReversed(reversalId);
    const [badDebt] = await accounting.badDebtJournals(reversalId);
    expect(
      badDebt?.lines.map((line) => [line.accountCode, line.debit.amount, line.credit.amount]),
    ).toEqual([
      [SYSTEM_ACCOUNT_CODE.BAD_DEBT_EXPENSE, fee, 0],
      [SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES, 0, fee],
    ]);
    expect(await balanceOf(world, SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES)).toBe(0);
    expect(await balanceOf(world, SYSTEM_ACCOUNT_CODE.BAD_DEBT_EXPENSE)).toBe(fee);

    const audit = await harness.connections.tenantShared
      .collection("audit_logs")
      .findOne({ organizationId: world.organizationA, action: "payment.due.writtenOff" });
    expect(audit?.["entityId"]).toBe(reversalId);
  });

  it("a second delivery of the reversal event posts the bad-debt journal once", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    await setPolicy(world, CLOSED_REQUEST_REVERSAL_POLICY.WRITE_OFF);
    const { booking, payment, fee } = await cancelledBookingWithFeePaid(world);
    const accounting = await accountingFor(world);
    await accounting.paymentReceived(payment.paymentId);
    await accounting.bookingCancelled(booking.bookingId);
    const reversed = await reverse(world, payment.paymentId, fee);
    const reversalId = reversed.body.data.paymentId as string;

    await accounting.paymentReversed(reversalId);
    await accounting.paymentReversed(reversalId);

    expect(await accounting.badDebtJournals(reversalId)).toHaveLength(1);
    expect(await balanceOf(world, SYSTEM_ACCOUNT_CODE.BAD_DEBT_EXPENSE)).toBe(fee);
  });

  it("open request: with WRITE_OFF, reversing a payment of an open booking reopens its due and writes nothing off", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    await setPolicy(world, CLOSED_REQUEST_REVERSAL_POLICY.WRITE_OFF);
    const contactId = await createCustomer(world);
    const booking = await createBooking(world, contactId);
    const payment = await payBooking(world, contactId, booking.bookingId, booking.total);
    expect(await bookingDues(world, contactId)).toEqual([]);

    const reversed = await reverse(world, payment.paymentId, booking.total);

    expect(reversed.status, JSON.stringify(reversed.body)).toBe(201);
    expect(reversed.body.data.writeOffs).toEqual([]);
    const dues = await bookingDues(world, contactId);
    expect(dues[0]).toMatchObject({ requestId: booking.bookingId, due: { amount: booking.total } });
  });

  it("rows from before this card read as open: a summary without closedAt reopens its due even under WRITE_OFF", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    await setPolicy(world, CLOSED_REQUEST_REVERSAL_POLICY.WRITE_OFF);
    const { contactId, booking, payment, fee } = await cancelledBookingWithFeePaid(world);
    const summaries = harness.connections.tenantShared.collection("payment_summaries");
    const unset = await summaries.updateOne(
      { organizationId: world.organizationA, requestId: booking.bookingId },
      { $unset: { closedAt: "" } },
    );
    expect(unset.matchedCount).toBe(1);

    const reversed = await reverse(world, payment.paymentId, fee);

    expect(reversed.body.data.writeOffs).toEqual([]);
    const dues = await bookingDues(world, contactId);
    expect(dues[0]).toMatchObject({ requestId: booking.bookingId, due: { amount: fee } });
  });
});

describe("the closed-request reversal setting and its boundaries", () => {
  it("refuses an unknown value, a member without settings rights, another organization's payment, another location's payment and a member without the reverse right", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const bad = await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [{ settingKey: PAYMENT_REVERSAL_CLOSED_REQUEST_SETTING_KEY, value: "FORGET_IT" }],
    });
    expect(bad.status).toBe(400);

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
    const viewer = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: viewerRoleId },
    ]);
    const cashier = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: cashierRoleId },
    ]);
    const denied = await viewer.actor.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [
        {
          settingKey: PAYMENT_REVERSAL_CLOSED_REQUEST_SETTING_KEY,
          value: CLOSED_REQUEST_REVERSAL_POLICY.WRITE_OFF,
        },
      ],
    });
    expect(denied.status).toBe(403);

    const { payment, fee } = await cancelledBookingWithFeePaid(world);
    const otherOrganization = await world.bob.callWith({
      method: "post",
      path: `/orgs/${world.organizationB}/payments/${payment.paymentId}/reverse`,
      idempotencyKey: newId(),
      body: { approvalToken: "any-token" },
    });
    expect(otherOrganization.status).toBe(404);
    const cashierReverse = await cashier.actor.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments/${payment.paymentId}/reverse`,
      idempotencyKey: newId(),
      body: { approvalToken: await approvalTokenFor(world, payment.paymentId, fee) },
    });
    expect(cashierReverse.status).toBe(403);

    const managerRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const managerAtOtherLocation = await addMemberWithAssignments(
      harness.app,
      world.organizationA,
      [{ locationId: world.locationA2, roleId: managerRoleId }],
    );
    const crossLocation = await managerAtOtherLocation.actor.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments/${payment.paymentId}/reverse`,
      idempotencyKey: newId(),
      body: { approvalToken: await approvalTokenFor(world, payment.paymentId, fee) },
    });
    // The existing location rule hides a payment of another location instead of answering 403.
    expect(crossLocation.status, JSON.stringify(crossLocation.body)).toBe(404);
  });
});

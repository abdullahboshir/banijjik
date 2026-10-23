import { EVENT_TYPE, type EventEnvelope } from "@banijjik/contracts";
import { POSTING_KEY, SYSTEM_ACCOUNT_CODE } from "@banijjik/contracts/accounting";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import {
  PAYMENT_METHOD,
  PAYMENT_REQUEST_TYPE,
  PAYMENT_STORE_CREDIT_EXPIRY_DAYS_SETTING_KEY,
  STORE_CREDIT_DIRECTION,
  STORE_CREDIT_ENTRY_KIND,
} from "@banijjik/contracts/payment";
import { asId, type OrganizationId } from "@banijjik/ids";
import { BOOKING_REQUIRE_APPROVAL_SETTING_KEY } from "@banijjik/contracts/booking";
import { EventHandlerRegistry, startEventProcessing } from "../../../../kernel/events/index.js";
import { models } from "../../../../kernel/db/index.js";
import { EVENT_STREAM_POSITION_MODEL_NAME } from "../../../../kernel/events/event-stream.schema.js";
import { outboxModel } from "../../../../test-support/event-fixtures.js";
import { createRedisTestScope, describeWithRedis } from "../../../../test-support/test-redis.js";
import { waitFor } from "../../../../test-support/wait-for.js";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoUnitOfWork } from "../../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../../kernel/events/index.js";
import { systemClock } from "../../../../kernel/time/index.js";
import { buildBookingRequestReader } from "../../../../routes/booking-request-reader.js";
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
  buildPostBookingsHandler,
  buildPostPaymentsHandler,
  MongoAccountRepository,
  MongoJournalRepository,
  seedSystemAccounts,
} from "../../accounting/index.js";
import { buildBookingPostingSourceAdapter } from "../../booking/index.js";
import {
  buildExpireStoreCreditJob,
  buildPaymentPostingSourceAdapter,
  MongoContactStoreCreditAdapter,
  MongoStoreCreditRepository,
  RequestReaderRegistry,
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

function makeEnvelope<TPayload>(
  organizationId: string,
  type: string,
  payload: TPayload,
): EventEnvelope<TPayload> {
  return {
    eventId: newId(),
    type: type as EventEnvelope<TPayload>["type"],
    version: 1,
    occurredAt: new Date().toISOString(),
    organizationId,
    actorUserId: null,
    payload,
  };
}

describe("payment and booking accounting posting through real handlers", () => {
  it("handles overpayment store-credit event without blocking the stream, posts IN, refund, multi-journal reversal, store-credit expiry, and late-cancel fee with balanced journals", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const contactId = await createCustomer(world);
    const b1 = await createBooking(world, contactId, "2026-11-01T04:00:00.000Z");
    const b2 = await createBooking(world, contactId, "2026-11-01T06:00:00.000Z");
    const total1 = b1.price.total.amount;
    const total2 = b2.price.total.amount;

    const accounts = new MongoAccountRepository();
    const journals = new MongoJournalRepository();
    await withOrganizationContext(world.organizationA, async () => {
      await seedSystemAccounts(
        { accounts, clock: systemClock },
        {
          organizationId: world.organizationA as import("@banijjik/ids").OrganizationId,
          actorUserId: null,
        },
      );
    });

    const readerRegistry = new RequestReaderRegistry();
    readerRegistry.register(PAYMENT_REQUEST_TYPE.BOOKING, buildBookingRequestReader());
    const paymentSource = buildPaymentPostingSourceAdapter(readerRegistry);
    const bookingSource = buildBookingPostingSourceAdapter();
    const postingDeps = {
      accounts,
      journals,
      events: kernelEventPublisher,
      audit: { record: async () => undefined },
      clock: systemClock,
    };
    const paymentHandler = buildPostPaymentsHandler({
      payments: paymentSource,
      posting: postingDeps,
    });
    const bookingHandler = buildPostBookingsHandler({
      bookings: bookingSource,
      posting: postingDeps,
    });

    // 1. Overpayment on b1: creates payment + PAYMENT_OVERPAYMENT store credit entry
    const overpayRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: world.locationA1,
        method: PAYMENT_METHOD.CASH,
        amount: money(total1 + 10000),
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
    expect(overpayRes.status).toBe(201);
    const overpayPaymentId = overpayRes.body.data.paymentId as string;

    const entriesRes = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/store-credit?contactId=${contactId}`,
    );
    const overpayEntryId = entriesRes.body.data[0].storeCreditEntryId as string;

    // Complete b1 BEFORE posting the payment to verify stored revenueState (BEFORE_REVENUE) is used
    const checkedIn = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/bookings/${b1.bookingId}/check-in`,
      { version: b1.version },
    );
    expect(checkedIn.status).toBe(200);
    const completed = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/bookings/${b1.bookingId}/complete`,
      { version: checkedIn.body.data.version },
    );
    expect(completed.status).toBe(200);

    // 2. Later payment on b2
    const pay2Res = await world.alice.callWith({
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
    expect(pay2Res.status).toBe(201);
    const pay2Id = pay2Res.body.data.paymentId as string;

    const uow = new MongoUnitOfWork();

    // Run real handler on overpayment, storeCredit.changed (non-EXPIRY), and later payment
    await withOrganizationContext(world.organizationA, async () => {
      await uow.run(() =>
        paymentHandler.handle(
          makeEnvelope(world.organizationA, EVENT_TYPE.PAYMENT_RECEIVED, {
            paymentId: overpayPaymentId,
          }),
        ),
      );
      // Must NOT throw or block the stream for non-EXPIRY store credit entry
      await uow.run(() =>
        paymentHandler.handle(
          makeEnvelope(world.organizationA, EVENT_TYPE.STORE_CREDIT_CHANGED, {
            storeCreditEntryId: overpayEntryId,
          }) as unknown as EventEnvelope<{ paymentId: string }>,
        ),
      );
      await uow.run(() =>
        paymentHandler.handle(
          makeEnvelope(world.organizationA, EVENT_TYPE.PAYMENT_RECEIVED, {
            paymentId: pay2Id,
          }),
        ),
      );
    });

    // Verify stored revenueState posted payment_in_advance (not after_revenue) + overpayment_to_store_credit
    await withOrganizationContext(world.organizationA, async () => {
      const advanceJournal = await journals.findBySource({
        sourceType: "PAYMENT",
        sourceId: overpayPaymentId,
        postingKey: POSTING_KEY.payment_in_advance,
      });
      const overpayJournal = await journals.findBySource({
        sourceType: "PAYMENT",
        sourceId: overpayPaymentId,
        postingKey: POSTING_KEY.overpayment_to_store_credit,
      });
      const pay2Journal = await journals.findBySource({
        sourceType: "PAYMENT",
        sourceId: pay2Id,
        postingKey: POSTING_KEY.payment_in_advance,
      });
      expect(advanceJournal).toBeDefined();
      expect(overpayJournal).toBeDefined();
      expect(pay2Journal).toBeDefined();
    });

    // 3. Reverse the overpayment payment (which has TWO journals: advance + overpayment_to_store_credit)
    const revToken = await getApprovalToken(world, {
      action: APPROVAL_ACTION.PAYMENT_REVERSAL,
      subjectKey: overpayPaymentId,
      amount: money(total1 + 10000),
      locationId: world.locationA1,
    });
    const revRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments/${overpayPaymentId}/reverse`,
      idempotencyKey: newId(),
      body: { approvalToken: revToken },
    });
    expect(revRes.status).toBe(201);
    const reversalPaymentId = revRes.body.data.paymentId as string;

    await withOrganizationContext(world.organizationA, async () => {
      await uow.run(() =>
        paymentHandler.handle(
          makeEnvelope(world.organizationA, EVENT_TYPE.PAYMENT_REVERSED, {
            paymentId: reversalPaymentId,
          }),
        ),
      );
      const allJournals = await journals.list({ page: 1, limit: 100 });
      const reversalJournals = allJournals.items.filter(
        (j) => j.sourceId === overpayPaymentId && j.reversesJournalEntryId !== null,
      );
      // Both original journals of overpayPaymentId must be reversed!
      expect(reversalJournals).toHaveLength(2);
    });

    // 4. Refund part of pay2 and post through real handler
    const refundRes = await world.alice.callWith({
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
            requestId: b2.bookingId,
            amount: money(10000),
          },
        ],
      },
    });
    expect(refundRes.status).toBe(201);
    const refundPaymentId = refundRes.body.data.paymentId as string;

    await withOrganizationContext(world.organizationA, async () => {
      await uow.run(() =>
        paymentHandler.handle(
          makeEnvelope(world.organizationA, EVENT_TYPE.PAYMENT_REFUNDED, {
            paymentId: refundPaymentId,
          }),
        ),
      );
      const refundJournal = await journals.findBySource({
        sourceType: "PAYMENT",
        sourceId: refundPaymentId,
        postingKey: POSTING_KEY.refund_advance,
      });
      expect(refundJournal).toBeDefined();
    });

    // 5. Store-credit expiry posted through real handler
    await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [{ settingKey: "payment.storeCreditExpiryDays", value: 1 }],
    });
    const adjToken = await getApprovalToken(world, {
      action: APPROVAL_ACTION.STORE_CREDIT_ADJUSTMENT,
      subjectKey: contactId,
      amount: money(5000),
      locationId: world.locationA1,
    });
    const adjRes = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/store-credit/adjustments`,
      idempotencyKey: newId(),
      body: {
        contactId,
        direction: STORE_CREDIT_DIRECTION.CREDIT,
        amount: money(5000),
        reason: "Credit to expire",
        approvalToken: adjToken,
      },
    });
    expect(adjRes.status).toBe(201);

    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const job = buildExpireStoreCreditJob({
      storeCredit: new MongoStoreCreditRepository(),
      contactStoreCredit: new MongoContactStoreCreditAdapter(),
      unitOfWork: new MongoUnitOfWork(),
      events: kernelEventPublisher,
      orgConfig: {
        forOrganization: async () => ({
          config: {
            settings: {
              [PAYMENT_STORE_CREDIT_EXPIRY_DAYS_SETTING_KEY]: 1,
            },
          },
        }),
      } as unknown as import("../../../platform/entitlement/index.js").OrgConfigService,
      clock: { now: () => futureDate },
    });
    await withOrganizationContext(world.organizationA, async () => {
      await job.run(world.organizationA, futureDate);
    });

    const afterExpiryEntries = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/store-credit?contactId=${contactId}`,
    );
    const expiryEntry = (
      afterExpiryEntries.body.data as { kind: string; storeCreditEntryId: string }[]
    ).find((e) => e.kind === STORE_CREDIT_ENTRY_KIND.EXPIRY);
    expect(expiryEntry).toBeDefined();
    if (!expiryEntry) throw new Error("missing expiryEntry");

    await withOrganizationContext(world.organizationA, async () => {
      await uow.run(() =>
        paymentHandler.handle(
          makeEnvelope(world.organizationA, EVENT_TYPE.STORE_CREDIT_CHANGED, {
            storeCreditEntryId: expiryEntry.storeCreditEntryId,
          }) as unknown as EventEnvelope<{ paymentId: string }>,
        ),
      );
      const expiryJournal = await journals.findBySource({
        sourceType: "STORE_CREDIT",
        sourceId: expiryEntry.storeCreditEntryId,
        postingKey: POSTING_KEY.store_credit_expiry,
      });
      expect(expiryJournal).toBeDefined();
    });

    // 6. Late booking cancel retains fee and posts CANCELLATION_FEE_INCOME through real bookingHandler
    await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [
        { settingKey: "booking.freeCancelHours", value: 100000 },
        { settingKey: "booking.lateCancelFee", value: "DEPOSIT" },
      ],
    });
    const cancelRes = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/bookings/${b2.bookingId}/cancel`,
      { version: b2.version, reason: "Late cancel for accounting test" },
    );
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.cancellationFeeRetained?.amount).toBe(total2 - 10000);

    await withOrganizationContext(world.organizationA, async () => {
      await uow.run(() =>
        bookingHandler.handle(
          makeEnvelope(world.organizationA, EVENT_TYPE.BOOKING_CANCELLED, {
            bookingId: b2.bookingId,
          }) as unknown as EventEnvelope<{ bookingId: string }>,
        ),
      );
      const cancelFeeJournal = await journals.findBySource({
        sourceType: "BOOKING",
        sourceId: b2.bookingId,
        postingKey: POSTING_KEY.cancellation_fee,
      });
      expect(cancelFeeJournal).toBeDefined();
      expect(
        cancelFeeJournal?.lines.find(
          (l) => l.accountCode === SYSTEM_ACCOUNT_CODE.CANCELLATION_FEE_INCOME,
        )?.credit.amount,
      ).toBe(total2 - 10000);
    });

    // Trial balance across all posted journals nets to 0
    const tbRes = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/accounting/trial-balance?asOf=2099-12-31`,
    );
    expect(tbRes.status).toBe(200);
    expect(tbRes.body.data.balances).toBe(true);
    expect(tbRes.body.data.debitTotal.amount).toBe(tbRes.body.data.creditTotal.amount);
    expect(tbRes.body.data.debitTotal.amount).toBeGreaterThan(0);
  });
});

describeWithRedis("booking accounting follows the real lifecycle stream", (redisUrl) => {
  it("posts booking_completed once after real creation, confirmation, check-in and completion", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const setting = await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [{ settingKey: BOOKING_REQUIRE_APPROVAL_SETTING_KEY, value: true }],
    });
    expect(setting.status).toBe(200);
    const contactId = await createCustomer(world);
    const booking = await createBooking(world, contactId);
    const confirmed = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/bookings/${booking.bookingId}/confirm`,
      { version: booking.version },
    );
    expect(confirmed.status).toBe(200);
    const checkedIn = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/bookings/${booking.bookingId}/check-in`,
      { version: confirmed.body.data.version },
    );
    expect(checkedIn.status).toBe(200);
    const completed = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/bookings/${booking.bookingId}/complete`,
      { version: checkedIn.body.data.version },
    );
    expect(completed.status).toBe(200);

    const accounts = new MongoAccountRepository();
    const journals = new MongoJournalRepository();
    await withOrganizationContext(world.organizationA, () =>
      seedSystemAccounts(
        { accounts, clock: systemClock },
        { organizationId: asId<OrganizationId>(world.organizationA), actorUserId: null },
      ),
    );
    const registry = new EventHandlerRegistry();
    registry.register(
      buildPostBookingsHandler({
        bookings: buildBookingPostingSourceAdapter(),
        posting: {
          accounts,
          journals,
          events: kernelEventPublisher,
          audit: { record: async () => undefined },
          clock: systemClock,
        },
      }),
    );
    const events = await outboxModel()
      .find({ organizationId: world.organizationA, orderingKey: `booking:${booking.bookingId}` })
      .sort({ streamSequence: 1 })
      .lean();
    expect(events.map((event) => event.type)).toEqual([
      EVENT_TYPE.BOOKING_REQUESTED,
      EVENT_TYPE.BOOKING_CONFIRMED,
      EVENT_TYPE.BOOKING_CHECK_IN_RECORDED,
      EVENT_TYPE.BOOKING_COMPLETED,
    ]);
    const scope = createRedisTestScope(redisUrl);
    const processing = startEventProcessing({
      redis: scope.client,
      registry,
      effectiveness: { isEffective: async () => true },
      clock: systemClock,
      queuePrefix: scope.prefix,
      pollIntervalMs: 20,
      retryBaseDelayMs: 20,
      streamWaitBaseDelayMs: 20,
    });
    try {
      await waitFor("booking stream position 4", async () => {
        const row = await models({})
          .get(EVENT_STREAM_POSITION_MODEL_NAME)
          .findOne({
            handlerKey: "accounting.postBookings",
            organizationId: world.organizationA,
            orderingKey: `booking:${booking.bookingId}`,
          })
          .lean<{ lastSequence: number }>();
        return row?.lastSequence === 4 ? true : undefined;
      });
      await withOrganizationContext(world.organizationA, async () => {
        const journal = await journals.findBySource({
          sourceType: "BOOKING",
          sourceId: booking.bookingId,
          postingKey: POSTING_KEY.booking_completed,
        });
        expect(journal).toBeDefined();
        expect(journal?.lines.reduce((total, line) => total + line.debit.amount, 0)).toBe(
          booking.price.total.amount,
        );
        const all = await journals.list({ page: 1, limit: 100 });
        expect(
          all.items.filter(
            (entry) =>
              entry.sourceId === booking.bookingId &&
              entry.postingKey === POSTING_KEY.booking_completed,
          ),
        ).toHaveLength(1);
      });
    } finally {
      for (const task of processing.shutdownTasks) await task.run();
      await scope.dispose();
    }
  });
});

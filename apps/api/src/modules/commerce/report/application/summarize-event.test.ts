import { EVENT_TYPE, type EventEnvelope } from "@banijjik/contracts";
import { REPORT_COUNTER, type ReportCounter } from "@banijjik/contracts/report";
import { describe, expect, it } from "vitest";
import { emptyCounters } from "../domain/summary-counters.js";
import type { SummaryIncrement } from "../domain/summary-increment.js";
import { buildSummarizeEventHandler } from "./summarize-event.handler.js";
import type {
  BookingFact,
  DailySummaryWriter,
  ExpenseFact,
  OrderFact,
  OrganizationLocalSettings,
  PaymentFact,
  ReportEventMarkerRepository,
  ReportSourceReader,
  SalesReturnFact,
} from "./ports/report-ports.js";

const ORGANIZATION_ID = "org-1";
const DHAKA = "Asia/Dhaka";
const NOON_DHAKA_25_OCTOBER = "2026-10-25T06:00:00.000Z";

/** Facts that the fake source modules hold, keyed by the id each event names. */
class FakeSources implements ReportSourceReader {
  readonly orders = new Map<string, OrderFact>();
  readonly salesReturns = new Map<string, SalesReturnFact>();
  readonly bookings = new Map<string, BookingFact>();
  readonly enrollmentLocations = new Map<string, string>();
  readonly payments = new Map<string, PaymentFact>();
  readonly expenses = new Map<string, ExpenseFact>();

  async readOrderFacts(orderId: string) {
    return this.orders.get(orderId);
  }
  async readSalesReturnFacts(salesReturnId: string) {
    return this.salesReturns.get(salesReturnId);
  }
  async readBookingFacts(bookingId: string) {
    return this.bookings.get(bookingId);
  }
  async readEnrollmentLocationId(enrollmentId: string) {
    return this.enrollmentLocations.get(enrollmentId);
  }
  async readPaymentFacts(paymentId: string) {
    return this.payments.get(paymentId);
  }
  async readExpenseFacts(expenseId: string) {
    return this.expenses.get(expenseId);
  }
}

/** Marker rows keyed like the unique index; a second record of the same pair finds it. */
class FakeMarkers implements ReportEventMarkerRepository {
  private readonly seen = new Set<string>();
  async recordIfNew(input: { readonly organizationId: string; readonly eventId: string }) {
    const key = `${input.organizationId}:${input.eventId}`;
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }
}

class FakeSummaries implements DailySummaryWriter {
  readonly increments: SummaryIncrement[] = [];
  async applyIncrement(input: { readonly increment: SummaryIncrement }) {
    this.increments.push(input.increment);
  }
}

const settings: OrganizationLocalSettings = {
  timeZoneOf: async () => DHAKA,
  currencyOf: async () => "BDT",
};

interface Harness {
  readonly sources: FakeSources;
  readonly summaries: FakeSummaries;
  readonly markers: FakeMarkers;
  deliver(input: {
    readonly type: string;
    readonly payload: object;
    readonly eventId?: string;
    readonly occurredAt?: string;
  }): Promise<void>;
}

/** One handler wired to fake sources; `deliver` builds the envelope a worker would hand over. */
function harnessWith(sources = new FakeSources()): Harness {
  const summaries = new FakeSummaries();
  const markers = new FakeMarkers();
  const handler = buildSummarizeEventHandler({
    reader: sources,
    settings,
    markers,
    summaries,
    clock: { now: () => new Date(NOON_DHAKA_25_OCTOBER) },
  });
  return {
    sources,
    summaries,
    markers,
    deliver: (input) => {
      const envelope = {
        eventId: input.eventId ?? "event-1",
        type: input.type,
        version: 1,
        occurredAt: input.occurredAt ?? NOON_DHAKA_25_OCTOBER,
        organizationId: ORGANIZATION_ID,
        actorUserId: null,
        payload: input.payload,
      };
      // Safe in a test: the handler reads only the payload field its event type names.
      return handler.handle(envelope as unknown as EventEnvelope<{ orderId: string }>);
    },
  };
}

function orderFact(overrides: Partial<OrderFact> = {}): OrderFact {
  return {
    locationId: "loc-1",
    currency: "BDT",
    // 00:30 on 25 October in Dhaka is still 24 October in UTC.
    completedAt: new Date("2026-10-24T18:30:00.000Z"),
    subtotal: 10_000,
    discountTotal: 500,
    taxTotal: 750,
    deliveryCharge: 200,
    grandTotal: 10_450,
    ...overrides,
  };
}

/** Sums the counter deltas of increments that share one location and day, as the stored row would. */
function counterTotalsOf(increments: readonly SummaryIncrement[]) {
  const totals = emptyCounters();
  for (const increment of increments) {
    for (const counter of Object.values(REPORT_COUNTER)) {
      totals[counter] += increment.counterDeltas[counter as ReportCounter] ?? 0;
    }
  }
  return totals;
}

describe("the summarize handler", () => {
  it("a completed order counts once in its location's day with gross, discount, tax, delivery and net", async () => {
    const harness = harnessWith();
    harness.sources.orders.set("order-1", orderFact());

    await harness.deliver({
      type: EVENT_TYPE.ORDER_COMPLETED,
      payload: { orderId: "order-1" },
    });

    expect(harness.summaries.increments).toEqual([
      {
        locationId: "loc-1",
        businessDate: "2026-10-25",
        counterDeltas: {
          ordersCompleted: 1,
          grossSales: 10_000,
          discountTotal: 500,
          taxTotal: 750,
          deliveryCharges: 200,
          netSales: 10_450,
        },
        methodDelta: undefined,
      },
    ]);
  });

  it("the same event delivered twice or replayed counts once", async () => {
    const harness = harnessWith();
    harness.sources.orders.set("order-1", orderFact());
    const completed = { type: EVENT_TYPE.ORDER_COMPLETED, payload: { orderId: "order-1" } };

    await harness.deliver(completed);
    await harness.deliver(completed);

    expect(harness.summaries.increments).toHaveLength(1);
  });

  it("two parallel deliveries count once", async () => {
    const harness = harnessWith();
    harness.sources.orders.set("order-1", orderFact());
    const completed = { type: EVENT_TYPE.ORDER_COMPLETED, payload: { orderId: "order-1" } };

    await Promise.all([harness.deliver(completed), harness.deliver(completed)]);

    expect(harness.summaries.increments).toHaveLength(1);
  });

  it("a return lowers net sales after returns; a reversed return brings it back", async () => {
    const harness = harnessWith();
    harness.sources.orders.set("order-1", orderFact());
    harness.sources.salesReturns.set("return-1", {
      locationId: "loc-1",
      currency: "BDT",
      businessDate: "2026-10-25",
      value: 2_000,
      reversedBusinessDate: null,
    });
    await harness.deliver({ type: EVENT_TYPE.ORDER_COMPLETED, payload: { orderId: "order-1" } });
    await harness.deliver({
      type: EVENT_TYPE.SALES_RETURN_CREATED,
      payload: { salesReturnId: "return-1", orderId: "order-1" },
      eventId: "event-2",
    });
    const afterReturn = counterTotalsOf(harness.summaries.increments);
    expect(afterReturn.netSales - afterReturn.returnsValue + afterReturn.returnsReversedValue).toBe(
      8_450,
    );

    harness.sources.salesReturns.set("return-1", {
      locationId: "loc-1",
      currency: "BDT",
      businessDate: "2026-10-25",
      value: 2_000,
      reversedBusinessDate: "2026-10-26",
    });
    await harness.deliver({
      type: EVENT_TYPE.SALES_RETURN_REVERSED,
      payload: { salesReturnId: "return-1", orderId: "order-1" },
      eventId: "event-3",
    });
    const afterReversal = counterTotalsOf(harness.summaries.increments);
    expect(
      afterReversal.netSales - afterReversal.returnsValue + afterReversal.returnsReversedValue,
    ).toBe(10_450);
    expect(harness.summaries.increments.at(-1)?.businessDate).toBe("2026-10-26");
  });

  it("bookings: completed with value, cancelled and no-show", async () => {
    const harness = harnessWith();
    harness.sources.bookings.set("booking-1", {
      locationId: "loc-1",
      currency: "BDT",
      total: 3_000,
    });
    const sameBooking = { bookingId: "booking-1" };

    await harness.deliver({
      type: EVENT_TYPE.BOOKING_COMPLETED,
      payload: sameBooking,
      eventId: "b1",
    });
    await harness.deliver({
      type: EVENT_TYPE.BOOKING_CANCELLED,
      payload: sameBooking,
      eventId: "b2",
    });
    await harness.deliver({
      type: EVENT_TYPE.BOOKING_NO_SHOW_MARKED,
      payload: sameBooking,
      eventId: "b3",
    });

    const totals = counterTotalsOf(harness.summaries.increments);
    expect(totals).toMatchObject({
      bookingsCompleted: 1,
      bookingsCompletedValue: 3_000,
      bookingsCancelled: 1,
      bookingsNoShow: 1,
    });
  });

  it("enrollments: created, activated, cancelled, renewed and check-ins", async () => {
    const harness = harnessWith();
    harness.sources.enrollmentLocations.set("enrollment-1", "loc-2");
    const enrollment = { enrollmentId: "enrollment-1" };
    const deliveries: readonly string[] = [
      EVENT_TYPE.ENROLLMENT_CREATED,
      EVENT_TYPE.ENROLLMENT_ACTIVATED,
      EVENT_TYPE.ENROLLMENT_CANCELLED,
      EVENT_TYPE.ENROLLMENT_RENEWED,
      EVENT_TYPE.ENROLLMENT_CHECK_IN_RECORDED,
    ];

    for (const [index, type] of deliveries.entries()) {
      const payload =
        type === EVENT_TYPE.ENROLLMENT_CHECK_IN_RECORDED
          ? { checkInId: "check-in-1", enrollmentId: "enrollment-1" }
          : enrollment;
      await harness.deliver({ type, payload, eventId: `e${index}` });
    }

    expect(counterTotalsOf(harness.summaries.increments)).toMatchObject({
      enrollmentsCreated: 1,
      enrollmentsActivated: 1,
      enrollmentsCancelled: 1,
      enrollmentsRenewed: 1,
      checkIns: 1,
    });
    expect(harness.summaries.increments.every((row) => row.locationId === "loc-2")).toBe(true);
  });

  it("payments count in and out by method on their own date; a reversal counts on the reversal date", async () => {
    const harness = harnessWith();
    harness.sources.payments.set(
      "pay-in",
      paymentFact({ amount: 5_000, direction: "IN", businessDate: "2026-10-25" }),
    );
    harness.sources.payments.set(
      "pay-refund",
      paymentFact({ amount: 1_000, direction: "REFUND", businessDate: "2026-10-25" }),
    );
    harness.sources.payments.set(
      "pay-reversal",
      paymentFact({ amount: 700, direction: "REVERSAL", businessDate: "2026-10-27" }),
    );

    await harness.deliver({
      type: EVENT_TYPE.PAYMENT_RECEIVED,
      payload: { paymentId: "pay-in" },
      eventId: "p1",
    });
    await harness.deliver({
      type: EVENT_TYPE.PAYMENT_REFUNDED,
      payload: { paymentId: "pay-refund" },
      eventId: "p2",
    });
    await harness.deliver({
      type: EVENT_TYPE.PAYMENT_REVERSED,
      payload: { paymentId: "pay-reversal" },
      eventId: "p3",
      occurredAt: "2026-10-27T06:00:00.000Z",
    });

    const [received, refunded, reversed] = harness.summaries.increments;
    expect(received?.methodDelta).toEqual({
      field: "paidInByMethod",
      method: "CASH",
      amount: 5_000,
    });
    expect(refunded?.methodDelta).toEqual({
      field: "refundedByMethod",
      method: "CASH",
      amount: 1_000,
    });
    expect(reversed?.methodDelta).toEqual({
      field: "reversedByMethod",
      method: "CASH",
      amount: 700,
    });
    expect(reversed?.businessDate).toBe("2026-10-27");
  });

  it("a voided expense subtracts on the void date", async () => {
    const harness = harnessWith();
    harness.sources.expenses.set("expense-1", {
      locationId: "loc-1",
      currency: "BDT",
      businessDate: "2026-10-25",
      amount: 3_000,
    });

    await harness.deliver({
      type: EVENT_TYPE.EXPENSE_POSTED,
      payload: { expenseId: "expense-1" },
      eventId: "x1",
    });
    await harness.deliver({
      type: EVENT_TYPE.EXPENSE_VOIDED,
      payload: { expenseId: "expense-1" },
      eventId: "x2",
      occurredAt: "2026-10-27T06:00:00.000Z",
    });

    const [posted, voided] = harness.summaries.increments;
    expect(posted).toMatchObject({
      businessDate: "2026-10-25",
      counterDeltas: { expensesTotal: 3_000 },
    });
    expect(voided).toMatchObject({
      businessDate: "2026-10-27",
      counterDeltas: { expensesTotal: -3_000 },
    });
  });

  it("a fact in another currency is refused and counts nothing", async () => {
    const harness = harnessWith();
    harness.sources.orders.set("order-1", orderFact({ currency: "USD" }));

    await expect(
      harness.deliver({ type: EVENT_TYPE.ORDER_COMPLETED, payload: { orderId: "order-1" } }),
    ).rejects.toThrow();
    expect(harness.summaries.increments).toEqual([]);
  });
});

function paymentFact(overrides: Partial<PaymentFact>): PaymentFact {
  return {
    locationId: "loc-1",
    currency: "BDT",
    businessDate: "2026-10-25",
    amount: 0,
    method: "CASH",
    direction: "IN",
    ...overrides,
  };
}

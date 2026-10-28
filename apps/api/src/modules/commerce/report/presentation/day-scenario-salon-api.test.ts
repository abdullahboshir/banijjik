import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "@banijjik/ids";
import {
  COMMISSION_CALCULATION,
  COMMISSION_SUBJECT_TYPE,
  COMMISSION_TARGET_TYPE,
} from "@banijjik/contracts/commission";
import { worldFor } from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import {
  closeRegister,
  openRegister,
  pairedTill,
  saleCall,
  type PosTill,
} from "../../../../test-support/pos-api-world.js";
import {
  publishOffering,
  setSetting,
  shopOf,
  type SalesShop,
} from "../../../../test-support/sales-api-world.js";
import { newContact } from "../../../../test-support/sales-return-world.js";
import {
  EVERY_DAY_SCHEDULE,
  aBookableInstant,
  exclusiveTaxOf,
  grantCommission,
  percentOf,
  performerMemberIdOf,
  replayLeavesOutcomeUnchanged,
  startDayScenarioApi,
  todayInDhaka,
  payCash,
} from "../../../../test-support/day-scenario-world.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const SALON = { industryTemplateKey: "SALON" };
const WALK_IN_LIST = 1_000;
const PRODUCT_LIST = 500;
const BOOKING_PRICE = 2_000;
const PROMOTION_BPS = 1_000;
const TAX_BPS = 1_500;
const COMMISSION_BPS = 1_000;

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startDayScenarioApi();
});
afterAll(async () => {
  await harness.dispose();
});

async function enableExclusiveVat(shop: SalesShop): Promise<void> {
  await setSetting(shop, "pricing.taxInclusive", false);
  const taxClass = await shop.actor.call("post", `/orgs/${shop.organizationId}/tax-classes`, {
    taxClassKey: "vat-walk-in",
    name: "VAT 15%",
    rateBasisPoints: TAX_BPS,
  });
  expect(taxClass.status).toBe(201);
}

async function activateWalkInPromotion(shop: SalesShop, offeringId: string): Promise<void> {
  const created = await shop.actor.call("post", `/orgs/${shop.organizationId}/promotions`, {
    name: "Ten percent off walk-in",
    priority: 10,
    target: { scope: "OFFERING", ids: [offeringId] },
    benefit: { type: "PERCENT", value: PROMOTION_BPS },
  });
  expect(created.status).toBe(201);
  const activated = await shop.actor.call(
    "patch",
    `/orgs/${shop.organizationId}/promotions/${created.body.data.promotionId as string}`,
    { version: 1, status: "ACTIVE" },
  );
  expect(activated.status).toBe(200);
}

async function publishWalkIn(shop: SalesShop) {
  return publishOffering(shop, {
    kind: "SERVICE",
    name: "Walk-in cut",
    priceAmount: WALK_IN_LIST,
    taxClassKey: "vat-walk-in",
    kindDetails: { durationMinutes: 5, bookingMode: "WALK_IN_ONLY" },
  });
}

async function publishBookable(shop: SalesShop, memberId: string) {
  const offering = await publishOffering(shop, {
    kind: "SERVICE",
    name: "Booked cut",
    priceAmount: BOOKING_PRICE,
    kindDetails: {
      durationMinutes: 5,
      requiresResource: true,
      resourceTypeKeys: ["STYLIST"],
    },
  });
  const resource = await shop.actor.call("post", `/orgs/${shop.organizationId}/resources`, {
    locationId: shop.locationId,
    resourceTypeKey: "STYLIST",
    name: "Stylist 1",
    capacity: 1,
    weeklySchedule: EVERY_DAY_SCHEDULE,
    offeringIds: [offering.offeringId],
    memberId,
  });
  expect(resource.status, JSON.stringify(resource.body)).toBe(201);
  return offering;
}

async function completePaidBooking(
  shop: SalesShop,
  offering: { offeringId: string; variantId: string },
): Promise<void> {
  const contactId = await newContact(shop);
  const created = await shop.actor.callWith({
    method: "post",
    path: `/orgs/${shop.organizationId}/bookings`,
    idempotencyKey: newId(),
    body: {
      offeringId: offering.offeringId,
      variantId: offering.variantId,
      locationId: shop.locationId,
      startsAt: aBookableInstant(),
      contactId,
    },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  let booking = created.body.data as { bookingId: string; version: number };
  await payCash(shop, {
    requestType: "BOOKING",
    requestId: booking.bookingId,
    amount: BOOKING_PRICE,
  });
  const checkedIn = await shop.actor.call(
    "post",
    `/orgs/${shop.organizationId}/bookings/${booking.bookingId}/check-in`,
    { version: booking.version },
  );
  expect(checkedIn.status, JSON.stringify(checkedIn.body)).toBe(200);
  booking = checkedIn.body.data as typeof booking;
  const completed = await shop.actor.call(
    "post",
    `/orgs/${shop.organizationId}/bookings/${booking.bookingId}/complete`,
    { version: booking.version },
  );
  expect(completed.status, JSON.stringify(completed.body)).toBe(200);
}

async function addServiceRule(shop: SalesShop, memberId: string): Promise<void> {
  const rule = await shop.actor.call("post", `/orgs/${shop.organizationId}/commission/rules`, {
    subjectType: COMMISSION_SUBJECT_TYPE.MEMBER,
    memberId,
    targetType: COMMISSION_TARGET_TYPE.KIND,
    offeringKind: "SERVICE",
    calculation: COMMISSION_CALCULATION.PERCENT,
    percentBasisPoints: COMMISSION_BPS,
  });
  expect(rule.status, JSON.stringify(rule.body)).toBe(201);
}

async function sellTillWalkIn(
  shop: SalesShop,
  world: Awaited<ReturnType<typeof worldFor>>,
  memberId: string,
  walkIn: { offeringId: string; variantId: string },
  product: { offeringId: string; variantId: string },
  tillGrand: number,
): Promise<PosTill & { posSessionId: string }> {
  const till = await pairedTill(harness.app, {
    manager: world.alice,
    cashier: world.alice,
    organizationId: shop.organizationId,
    locationId: shop.locationId,
  });
  const session = await openRegister(till);
  const sold = await saleCall(till, {
    lines: [
      { ...walkIn, quantity: 1, performedByMemberId: memberId },
      { ...product, quantity: 1 },
    ],
    payments: [{ method: "CASH", amount: { amount: tillGrand, currency: "BDT" } }],
  });
  expect(sold.status, JSON.stringify(sold.body)).toBe(201);
  expect(sold.body.data.order.totals.grandTotal.amount).toBe(tillGrand);
  const closed = await closeRegister(till, { session, countedCash: tillGrand });
  expect(closed.status, JSON.stringify(closed.body)).toBe(200);
  return { ...till, posSessionId: session.posSessionId };
}

describe("salon day scenario", () => {
  it("a salon day of a booking, a taxed discounted walk-in, a product at the till, then reports, z-report, trial balance and commission match the named amounts, also on replay", async () => {
    const walkInQuote = exclusiveTaxOf(WALK_IN_LIST, PROMOTION_BPS, TAX_BPS);
    const tillGrand = walkInQuote.grand + PRODUCT_LIST;
    const commissionOpen =
      percentOf(walkInQuote.afterDiscount, COMMISSION_BPS) +
      percentOf(BOOKING_PRICE, COMMISSION_BPS);
    const world = await worldFor(harness, RETAIL, SALON);
    const shop = shopOf(world);
    await grantCommission(shop.organizationId);
    const memberId = await performerMemberIdOf(shop);
    await addServiceRule(shop, memberId);
    await enableExclusiveVat(shop);
    const walkIn = await publishWalkIn(shop);
    await activateWalkInPromotion(shop, walkIn.offeringId);
    const product = await publishOffering(shop, {
      kind: "PRODUCT",
      name: "Comb",
      priceAmount: PRODUCT_LIST,
    });
    const bookable = await publishBookable(shop, memberId);
    await completePaidBooking(shop, bookable);
    const till = await sellTillWalkIn(shop, world, memberId, walkIn, product, tillGrand);
    const today = todayInDhaka();
    const outcome = await replayLeavesOutcomeUnchanged({
      actor: shop.actor,
      organizationId: shop.organizationId,
      today,
      tillSession: { till, posSessionId: till.posSessionId },
    });
    expect(outcome.trialBalances).toBe(true);
    expect(outcome.homeToday.counters.ordersCompleted).toBe(1);
    expect(outcome.homeToday.counters.netSales).toBe(tillGrand);
    expect(outcome.homeToday.counters.discountTotal).toBe(walkInQuote.discount);
    expect(outcome.homeToday.counters.taxTotal).toBe(walkInQuote.tax);
    expect(outcome.homeToday.counters.bookingsCompleted).toBe(1);
    expect(outcome.homeToday.counters.bookingsCompletedValue).toBe(BOOKING_PRICE);
    expect(outcome.homeToday.paidInByMethod.CASH).toBe(tillGrand + BOOKING_PRICE);
    expect(outcome.dailyTotals.counters.netSales).toBe(tillGrand);
    expect(outcome.commission[0]?.open.amount).toBe(commissionOpen);
    expect(outcome.zReport).toMatchObject({
      salesCount: 1,
      grandTotal: { amount: tillGrand },
    });
  });
});

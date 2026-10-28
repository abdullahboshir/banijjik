import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "@banijjik/ids";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { worldFor } from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import {
  publishOffering,
  shopOf,
  type SalesShop,
} from "../../../../test-support/sales-api-world.js";
import {
  grantCommission,
  payCash,
  replayLeavesOutcomeUnchanged,
  startDayScenarioApi,
  todayInDhaka,
} from "../../../../test-support/day-scenario-world.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const COACHING = { industryTemplateKey: "COACHING" };
const PLAN_FEE = 4_000;
const PARTIAL = 1_500;

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startDayScenarioApi();
});
afterAll(async () => {
  await harness.dispose();
});

async function publishMonthlyPlan(shop: SalesShop) {
  return publishOffering(shop, {
    kind: "PLAN",
    name: "Term fee",
    priceAmount: PLAN_FEE,
    unitKey: "SESSION",
    kindDetails: { billingPeriod: { unit: "MONTH", count: 1 }, freezeAllowed: false },
  });
}

async function studentWithGuardian(shop: SalesShop): Promise<string> {
  const created = await shop.actor.call("post", `/orgs/${shop.organizationId}/contacts`, {
    contactType: "PERSON",
    name: "Student One",
    contactRoles: ["CUSTOMER"],
    customFields: {
      class_level: "CLASS_5",
      guardian: { create: { name: "Abdul Karim", phone: "01712349001" } },
    },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return (created.body.data as { contactId: string }).contactId;
}

async function enrollStudent(
  shop: SalesShop,
  plan: { offeringId: string; variantId: string },
  contactId: string,
) {
  const response = await shop.actor.callWith({
    method: "post",
    path: `/orgs/${shop.organizationId}/enrollments`,
    idempotencyKey: newId(),
    body: {
      locationId: shop.locationId,
      contactId,
      offeringId: plan.offeringId,
      variantId: plan.variantId,
      startsOn: todayInDhaka(),
      autoRenew: false,
    },
  });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  const enrollmentId = (response.body.data as { enrollmentId: string }).enrollmentId;
  const detail = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/enrollments/${enrollmentId}`,
  );
  expect(detail.status).toBe(200);
  return detail.body.data as {
    enrollmentId: string;
    periods: { enrollmentPeriodId: string }[];
  };
}

async function dueRemaining(shop: SalesShop, enrollmentPeriodId: string): Promise<number> {
  const response = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/dues?requestType=${PAYMENT_REQUEST_TYPE.ENROLLMENT}`,
  );
  expect(response.status).toBe(200);
  const row = (response.body.data as { requestId: string; due: { amount: number } }[]).find(
    (item) => item.requestId === enrollmentPeriodId,
  );
  if (row === undefined) throw new Error("expected the period on the dues list");
  return row.due.amount;
}

describe("coaching day scenario", () => {
  it("a coaching day of a guardian enrollment, a partial fee and the due then reports, trial balance and commission match the named amounts, also on replay", async () => {
    const world = await worldFor(harness, RETAIL, COACHING);
    const shop = shopOf(world);
    await grantCommission(shop.organizationId);
    const plan = await publishMonthlyPlan(shop);
    const contactId = await studentWithGuardian(shop);
    const enrollment = await enrollStudent(shop, plan, contactId);
    const period = enrollment.periods[0];
    if (period === undefined) throw new Error("expected a period");
    await payCash(shop, {
      requestType: "ENROLLMENT",
      requestId: period.enrollmentPeriodId,
      amount: PARTIAL,
    });
    expect(await dueRemaining(shop, period.enrollmentPeriodId)).toBe(PLAN_FEE - PARTIAL);
    const today = todayInDhaka();
    const outcome = await replayLeavesOutcomeUnchanged({
      actor: shop.actor,
      organizationId: shop.organizationId,
      today,
    });
    expect(outcome.trialBalances).toBe(true);
    expect(outcome.homeToday.counters.enrollmentsCreated).toBe(1);
    expect(outcome.homeToday.paidInByMethod.CASH).toBe(PARTIAL);
    expect(outcome.dailyTotals.counters.enrollmentsCreated).toBe(1);
    expect(outcome.commission).toEqual([]);
    expect(outcome.zReport).toBeNull();
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "@banijjik/ids";
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
const GYM = { industryTemplateKey: "GYM" };
const PLAN_FEE = 3_000;

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
    name: "Membership",
    priceAmount: PLAN_FEE,
    unitKey: "SESSION",
    kindDetails: { billingPeriod: { unit: "MONTH", count: 1 }, freezeAllowed: false },
  });
}

async function gymMember(shop: SalesShop): Promise<string> {
  const response = await shop.actor.call("post", `/orgs/${shop.organizationId}/contacts`, {
    name: "Member",
    contactType: "PERSON",
    contactRoles: ["RELATED"],
  });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return (response.body.data as { contactId: string }).contactId;
}

async function enrollToday(shop: SalesShop, plan: { offeringId: string; variantId: string }) {
  const contactId = await gymMember(shop);
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
  return {
    contactId,
    enrollment: response.body.data as {
      enrollmentId: string;
      version: number;
      status: string;
      periods: { enrollmentPeriodId: string }[];
    },
  };
}

async function getEnrollment(shop: SalesShop, enrollmentId: string) {
  const response = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/enrollments/${enrollmentId}`,
  );
  expect(response.status).toBe(200);
  return response.body.data as {
    enrollmentId: string;
    version: number;
    status: string;
    periods: { enrollmentPeriodId: string }[];
  };
}

async function activateIfPending(
  shop: SalesShop,
  enrollment: { enrollmentId: string; version: number; status: string },
): Promise<{ enrollmentId: string; version: number; status: string }> {
  if (enrollment.status === "ACTIVE") return enrollment;
  const response = await shop.actor.call(
    "post",
    `/orgs/${shop.organizationId}/enrollments/${enrollment.enrollmentId}/activate`,
    { version: enrollment.version },
  );
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return (response.body.data as { enrollment: typeof enrollment }).enrollment;
}

async function checkInTwice(
  shop: SalesShop,
  input: { contactId: string; enrollmentId: string },
): Promise<void> {
  const path = `/orgs/${shop.organizationId}/check-ins`;
  const body = {
    contactId: input.contactId,
    enrollmentId: input.enrollmentId,
    locationId: shop.locationId,
  };
  expect((await shop.actor.call("post", path, body)).status).toBe(201);
  expect((await shop.actor.call("post", path, body)).status).toBe(201);
}

describe("gym day scenario", () => {
  it("a gym day of an enrollment, its payment, two check-ins and a renewal then reports, trial balance and commission match the named amounts, also on replay", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    const shop = shopOf(world);
    await grantCommission(shop.organizationId);
    const plan = await publishMonthlyPlan(shop);
    const { contactId, enrollment: created } = await enrollToday(shop, plan);
    const firstPeriod = (await getEnrollment(shop, created.enrollmentId)).periods[0];
    if (firstPeriod === undefined) throw new Error("expected a period");
    await payCash(shop, {
      requestType: "ENROLLMENT",
      requestId: firstPeriod.enrollmentPeriodId,
      amount: PLAN_FEE,
    });
    const enrollment = await activateIfPending(
      shop,
      await getEnrollment(shop, created.enrollmentId),
    );
    await checkInTwice(shop, { contactId, enrollmentId: enrollment.enrollmentId });
    const current = await getEnrollment(shop, enrollment.enrollmentId);
    const renewed = await shop.actor.call(
      "post",
      `/orgs/${shop.organizationId}/enrollments/${enrollment.enrollmentId}/renew`,
      { version: current.version },
    );
    expect(renewed.status, JSON.stringify(renewed.body)).toBe(200);
    const today = todayInDhaka();
    const outcome = await replayLeavesOutcomeUnchanged({
      actor: shop.actor,
      organizationId: shop.organizationId,
      today,
    });
    expect(outcome.trialBalances).toBe(true);
    expect(outcome.homeToday.counters.enrollmentsCreated).toBe(1);
    expect(outcome.homeToday.counters.enrollmentsActivated).toBe(1);
    expect(outcome.homeToday.counters.enrollmentsRenewed).toBe(1);
    expect(outcome.homeToday.counters.checkIns).toBe(2);
    expect(outcome.homeToday.paidInByMethod.CASH).toBe(PLAN_FEE);
    expect(outcome.dailyTotals.counters.checkIns).toBe(2);
    expect(outcome.commission).toEqual([]);
    expect(outcome.zReport).toBeNull();
  });
});

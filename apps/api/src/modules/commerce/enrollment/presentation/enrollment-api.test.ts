import { loginViaApi } from "../../../../test-support/auth-api-scenarios.js";
import { businessDateOf } from "../../booking/index.js";
import { money } from "../../../../test-support/catalog-world.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";
import type { EnrollmentPeriod } from "../domain/enrollment.entity.js";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "@banijjik/ids";
import { ENROLLMENT_SETTING } from "@banijjik/contracts/enrollment";
import {
  startCatalogApi,
  worldFor,
  memberWithRole,
} from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import type { Enrollment } from "../domain/enrollment.entity.js";
import { addDays } from "../domain/period-dates.js";

registerIamApiModels();
let harness: IamApiHarness;
beforeAll(async () => {
  harness = await startCatalogApi();
});
afterAll(async () => {
  await harness.dispose();
});
const RETAIL = { industryTemplateKey: "RETAIL" };
const GYM = { industryTemplateKey: "GYM" };

describe("enrollment API", () => {
  it("creates, activates, freezes, unfreezes, renews and cancels with audited ordered events", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await harness.connections.platform
      .collection("platform_subscriptions")
      .updateOne(
        { organizationId: world.organizationA },
        { $set: { trialEndsAt: new Date("2030-01-01") } },
      );
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    const plan = await publishPlan(world, { admissionFee: { amount: 999, currency: "BDT" } });
    const contactId = await contact(world);
    const created = await enroll(world, {
      ...plan,
      contactId,
      startsOn: addDays(today(harness), 1),
      autoRenew: false,
    });
    expect(
      created.status,
      JSON.stringify({
        response: created.body,
        errors: harness.logs.lines().filter((line) => line["err"] !== undefined),
      }),
    ).toBe(201);
    let enrollment = created.body.data as Enrollment;
    expect(enrollment.status).toBe("PENDING");
    await advanceDays(harness, world, 1);
    enrollment = await action(world, enrollment, "activate");
    const first = await getEnrollment(world, enrollment.enrollmentId);
    const firstPeriod = first.periods[0];
    if (firstPeriod === undefined) throw new Error("Missing first period");
    expect(firstPeriod.fee.amount).toBe(11000);
    enrollment = await action(world, enrollment, "freeze");
    expect((await getEnrollment(world, enrollment.enrollmentId)).periods[0]?.periodEndsOn).toBe(
      firstPeriod.periodEndsOn,
    );
    await advanceDays(harness, world, 2);
    enrollment = await action(world, enrollment, "unfreeze");
    const extended = await getEnrollment(world, enrollment.enrollmentId);
    expect(extended.periods[0]?.periodEndsOn).toBe(addDays(firstPeriod.periodEndsOn, 2));
    await advanceDays(harness, world, 35);
    enrollment = await action(world, enrollment, "renew");
    const renewed = await getEnrollment(world, enrollment.enrollmentId);
    expect(renewed.periods).toHaveLength(2);
    expect(renewed.periods[1]?.fee.amount).toBe(10001);
    expect(renewed.periods[1]?.periodStartsOn).toBe(
      addDays(extended.periods[0]?.periodEndsOn ?? "", 1),
    );
    expect(renewed.periods[0]).toEqual(extended.periods[0]);
    enrollment = await action(world, enrollment, "freeze");
    await advanceDays(harness, world, 1);
    enrollment = await action(world, enrollment, "unfreeze");
    expect((await getEnrollment(world, enrollment.enrollmentId)).periods[0]).toEqual(
      renewed.periods[0],
    );
    enrollment = await action(world, enrollment, "cancel");
    expect(enrollment.status).toBe("CANCELLED");
    const repeat = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/enrollments/${enrollment.enrollmentId}/activate`,
      { version: enrollment.version },
    );
    expect(repeat.status).toBe(400);
    const events = await harness.connections.platform
      .collection("outbox_events")
      .find({
        organizationId: world.organizationA,
        orderingKey: `enrollment:${enrollment.enrollmentId}`,
      })
      .toArray();
    expect(events.length).toBeGreaterThanOrEqual(6);
  });

  it("allows only one parallel enrollment for the last plan seat", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    const plan = await publishPlan(world, { capacity: 1 });
    const contactId = await contact(world);
    const attempts = await Promise.all([
      enroll(world, { ...plan, contactId, startsOn: today(harness) }),
      enroll(world, { ...plan, contactId, startsOn: today(harness) }),
    ]);
    expect(attempts.map((response) => response.status).sort()).toEqual([201, 409]);
  });

  it("enforces validation, permissions, organization and location boundaries", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    const plan = await publishPlan(world);
    const contactId = await contact(world);
    const created = await enroll(world, { ...plan, contactId, startsOn: today(harness) });
    expect(created.status).toBe(201);
    const enrollment = created.body.data as Enrollment;
    await harness.connections.platform
      .collection("organizations")
      .updateOne(
        { organizationId: world.organizationB },
        { $set: GYM, $inc: { configVersion: 1 } },
      );
    expect((await enroll(world, { ...plan, contactId, startsOn: "2026-02-30" })).status).toBe(400);
    expect(
      (
        await enroll(world, {
          ...plan,
          contactId,
          startsOn: today(harness),
          organizationId: world.organizationB,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await world.bob.call(
          "get",
          `/orgs/${world.organizationB}/enrollments/${enrollment.enrollmentId}`,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await world.sam.callWith({
          method: "post",
          path: `/orgs/${world.organizationA}/enrollments`,
          idempotencyKey: newId(),
          body: { ...plan, contactId, startsOn: today(harness), locationId: world.locationA2 },
        })
      ).status,
    ).toBe(403);
    const viewer = await memberWithRole(harness, world, "VIEWER");
    expect(
      (
        await viewer.call("post", `/orgs/${world.organizationA}/enrollments`, {
          ...plan,
          contactId,
          startsOn: today(harness),
          locationId: world.locationA1,
        })
      ).status,
    ).toBe(403);
    const listed = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/enrollments?limit=1`,
    );
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.meta.limit).toBe(1);
  });
  it("locks the first recurring price on renewal and replays create idempotently", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    await setting(world, ENROLLMENT_SETTING.LOCK_PRICE, true);
    const plan = await publishPlan(world);
    const contactId = await contact(world);
    const key = newId();
    const request = {
      method: "post" as const,
      path: `/orgs/${world.organizationA}/enrollments`,
      idempotencyKey: key,
      body: {
        ...plan,
        locationId: world.locationA1,
        contactId,
        startsOn: addDays(today(harness), -35),
        autoRenew: false,
      },
    };
    const created = await world.alice.callWith(request);
    const repeated = await world.alice.callWith(request);
    expect(created.status).toBe(201);
    expect(repeated.status).toBe(201);
    expect(repeated.body.data.enrollmentId).toBe(created.body.data.enrollmentId);
    await harness.connections.tenantShared
      .collection("offerings")
      .updateOne(
        { organizationId: world.organizationA, offeringId: plan.offeringId },
        { $set: { "variants.0.price.amount": 22222 } },
      );
    const renewed = await action(world, created.body.data as Enrollment, "renew");
    expect((await getEnrollment(world, renewed.enrollmentId)).periods[1]?.fee.amount).toBe(10001);
    expect(
      await harness.connections.tenantShared
        .collection("enrollments")
        .countDocuments({ organizationId: world.organizationA }),
    ).toBe(1);
  });
  it("paginates periods and filters overdue enrollments", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    const plan = await publishPlan(world);
    const created = await enroll(world, {
      ...plan,
      contactId: await contact(world),
      startsOn: addDays(today(harness), -35),
      autoRenew: false,
    });
    const renewed = await action(world, created.body.data as Enrollment, "renew");
    const path = `/orgs/${world.organizationA}/enrollments`;
    const page = await world.alice.call(
      "get",
      `${path}/${renewed.enrollmentId}/periods?limit=1&page=2`,
    );
    expect(page.status, JSON.stringify(page.body)).toBe(200);
    expect(page.body.data).toHaveLength(1);
    expect(page.body.data[0].periodNumber).toBe(2);
    expect(page.body.meta).toMatchObject({ limit: 1, page: 2, hasNext: false });
    expect((await world.alice.call("get", `${path}?overdue=true`)).body.data).toEqual([]);
    expect(
      (await world.alice.call("get", `${path}?organizationId=${world.organizationB}`)).status,
    ).toBe(400);
  });
});

type EnrollmentDetail = Enrollment & { periods: EnrollmentPeriod[] };

async function publishPlan(
  world: TwoOrganizations,
  details: object = {},
): Promise<{ offeringId: string; variantId: string }> {
  const created = await world.alice.call("post", `/orgs/${world.organizationA}/offerings`, {
    kind: "PLAN",
    name: "Membership",
    kindDetails: {
      billingPeriod: { unit: "MONTH", count: 1 },
      freezeAllowed: true,
      maxFreezeDaysPerYear: 30,
      ...details,
    },
    variants: [{ name: "Monthly", price: money(10001), unitKey: "SESSION" }],
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const offering = created.body.data as {
    offeringId: string;
    version: number;
    variants: { variantId: string }[];
  };
  const published = await world.alice.call(
    "post",
    `/orgs/${world.organizationA}/offerings/${offering.offeringId}/publish`,
    { version: offering.version },
  );
  expect(published.status, JSON.stringify(published.body)).toBe(200);
  const variantId = offering.variants[0]?.variantId;
  if (variantId === undefined) throw new Error("Missing variant");
  return { offeringId: offering.offeringId, variantId };
}

async function contact(world: TwoOrganizations, fields: object = {}): Promise<string> {
  const response = await world.alice.call("post", `/orgs/${world.organizationA}/contacts`, {
    name: "Member",
    contactType: "PERSON",
    contactRoles: ["RELATED"],
    ...fields,
  });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return (response.body.data as { contactId: string }).contactId;
}

async function setting(world: TwoOrganizations, settingKey: string, value: unknown): Promise<void> {
  const response = await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
    items: [{ settingKey, value }],
  });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
}

function today(harness: IamApiHarness): string {
  return businessDateOf(harness.clock.now(), "Asia/Dhaka");
}

async function enroll(
  world: TwoOrganizations,
  body: object,
): Promise<import("supertest").Response> {
  return world.alice.callWith({
    method: "post",
    path: `/orgs/${world.organizationA}/enrollments`,
    idempotencyKey: newId(),
    body: { locationId: world.locationA1, ...body },
  });
}

async function getEnrollment(
  world: TwoOrganizations,
  enrollmentId: string,
): Promise<EnrollmentDetail> {
  const response = await world.alice.call(
    "get",
    `/orgs/${world.organizationA}/enrollments/${enrollmentId}`,
  );
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return response.body.data as EnrollmentDetail;
}

async function action(
  world: TwoOrganizations,
  enrollment: Enrollment,
  name: string,
): Promise<Enrollment> {
  const response = await world.alice.call(
    "post",
    `/orgs/${world.organizationA}/enrollments/${enrollment.enrollmentId}/${name}`,
    { version: enrollment.version },
  );
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return (response.body.data as { enrollment: Enrollment }).enrollment;
}

async function advanceDays(
  harness: IamApiHarness,
  world: TwoOrganizations,
  days: number,
): Promise<void> {
  harness.clock.advanceDays(days);
  Object.assign(world.alice.person.session, await loginViaApi(harness.app, world.alice.person));
}

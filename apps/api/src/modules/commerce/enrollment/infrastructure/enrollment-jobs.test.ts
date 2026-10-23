import { newId } from "@banijjik/ids";
import { businessDateOf } from "../../booking/index.js";
import { money } from "../../../../test-support/catalog-world.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";
import type { EnrollmentPeriod } from "../domain/enrollment.entity.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ENROLLMENT_SETTING,
  ENROLLMENT_JOB,
  ENROLLMENT_EVENT_TYPE,
} from "@banijjik/contracts/enrollment";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { withOrganizationContext } from "../../../../test-support/organization-context.js";
import { buildModuleRegistry } from "../../../../routes/module-registry.js";
import {
  buildOrganizationConfigPorts,
  buildResolvedConfigSources,
} from "../../../../routes/organization-config-ports.js";
import { buildOrgConfigService } from "../../../platform/entitlement/index.js";
import { buildIndustryTemplateReader } from "../../../platform/industry/index.js";
import { runScheduledJob } from "../../../../kernel/jobs/index.js";
import { buildEnrollmentWorkerJobs } from "../../../../routes/enrollment-worker-jobs.js";
import { addDays } from "../domain/period-dates.js";
import type { Enrollment } from "../domain/enrollment.entity.js";

registerIamApiModels();
let harness: IamApiHarness;
beforeAll(async () => {
  harness = await startCatalogApi();
  harness.clock.advanceSeconds(
    (new Date("2026-03-01T02:00:00+06:00").getTime() - harness.clock.now().getTime()) / 1000,
  );
});
afterAll(async () => {
  await harness.dispose();
});
const RETAIL = { industryTemplateKey: "RETAIL" };
const GYM = { industryTemplateKey: "GYM" };

function jobsAt(date: string) {
  const now = new Date(`${date}T00:00:00+06:00`);
  const clock = { now: () => now };
  const registry = buildModuleRegistry();
  const orgConfig = buildOrgConfigService({
    registry,
    clock,
    ...buildOrganizationConfigPorts(),
    ...buildResolvedConfigSources(registry),
    templates: buildIndustryTemplateReader(clock),
  });
  return { jobs: buildEnrollmentWorkerJobs({ clock, registry, orgConfig }), now };
}
async function runTwice(organizationId: string, date: string, key: string): Promise<void> {
  const { jobs, now } = jobsAt(date);
  const job = jobs.find((entry) => entry.jobKey === key);
  if (job === undefined) throw new Error("Missing job");
  await withOrganizationContext(organizationId, async () => {
    await job.run(organizationId, now);
    await job.run(organizationId, now);
  });
}

describe("enrollment daily jobs", () => {
  it("renews once, expires non-renewing plans and completes fixed terms without overlap", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    const plan = await publishPlan(world, { billingPeriod: { unit: "DAY", count: 1 } });
    const contactId = await contact(world);
    const renewed = await enroll(world, {
      ...plan,
      contactId,
      startsOn: addDays(today(harness), -1),
      autoRenew: true,
    });
    const expired = await enroll(world, {
      ...plan,
      contactId,
      startsOn: addDays(today(harness), -1),
      autoRenew: false,
    });
    const fixedPlan = await publishPlan(world, {
      billingPeriod: { unit: "DAY", count: 1 },
      fixedTermPeriods: 1,
    });
    const completed = await enroll(world, {
      ...fixedPlan,
      contactId,
      startsOn: addDays(today(harness), -1),
      autoRenew: true,
    });
    for (const response of [renewed, expired, completed])
      expect(response.status, JSON.stringify(response.body)).toBe(201);
    await runTwice(world.organizationA, today(harness), ENROLLMENT_JOB.RENEW);
    const detail = await getEnrollment(world, (renewed.body.data as Enrollment).enrollmentId);
    expect(detail.periods).toHaveLength(2);
    expect(detail.periods[1]?.periodStartsOn).toBe(today(harness));
    expect(
      (await getEnrollment(world, (expired.body.data as Enrollment).enrollmentId)).status,
    ).toBe("EXPIRED");
    expect(
      (await getEnrollment(world, (completed.body.data as Enrollment).enrollmentId)).status,
    ).toBe("COMPLETED");
  });

  it("marks overdue and emits one reminder on repeated runs", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    const plan = await publishPlan(world);
    const created = await enroll(world, {
      ...plan,
      contactId: await contact(world),
      startsOn: addDays(today(harness), -6),
    });
    expect(created.status).toBe(201);
    const enrollment = created.body.data as Enrollment;
    await runTwice(world.organizationA, today(harness), ENROLLMENT_JOB.OVERDUE);
    const detail = await getEnrollment(world, enrollment.enrollmentId);
    expect(detail.status).toBe("OVERDUE");
    const end = detail.periods[0]?.periodEndsOn;
    if (end === undefined) throw new Error("Missing period");
    await runTwice(world.organizationA, addDays(end, -3), ENROLLMENT_JOB.REMIND);
    await runTwice(world.organizationA, addDays(end, -2), ENROLLMENT_JOB.REMIND);
    const events = await harness.connections.platform
      .collection("outbox_events")
      .find({
        organizationId: world.organizationA,
        type: ENROLLMENT_EVENT_TYPE.ENROLLMENT_RENEWAL_DUE,
      })
      .toArray();
    expect(events).toHaveLength(1);
  });

  it("skips frozen enrollments for renew and overdue jobs", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    const plan = await publishPlan(world, { billingPeriod: { unit: "DAY", count: 1 } });
    const created = await enroll(world, {
      ...plan,
      contactId: await contact(world),
      startsOn: today(harness),
      autoRenew: true,
    });
    const frozen = await action(world, created.body.data as Enrollment, "freeze");
    await runTwice(world.organizationA, addDays(today(harness), 10), ENROLLMENT_JOB.RENEW);
    await runTwice(world.organizationA, addDays(today(harness), 10), ENROLLMENT_JOB.OVERDUE);
    const detail = await getEnrollment(world, frozen.enrollmentId);
    expect(detail.status).toBe("FROZEN");
    expect(detail.periods).toHaveLength(1);
  });

  it("continues to the next organization after one organization fails", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    const seen: string[] = [];
    await runScheduledJob(
      {
        jobKey: ENROLLMENT_JOB.RENEW,
        everyMinutes: 1,
        run: async (organizationId) => {
          seen.push(organizationId);
          if (organizationId === world.organizationA)
            throw new Error("Test organization unavailable");
        },
      },
      { clock: harness.clock, effectiveness: { isEffective: async () => true } },
    );
    expect(seen).toContain(world.organizationA);
    expect(seen).toContain(world.organizationB);
  });
  it("promotes a manual advance renewal once without moving the current period early", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    const plan = await publishPlan(world);
    const created = await enroll(world, {
      ...plan,
      contactId: await contact(world),
      startsOn: today(harness),
      autoRenew: false,
    });
    const row = created.body.data as Enrollment;
    const renewed = await action(world, row, "renew");
    expect(renewed.currentEnrollmentPeriodId).toBe(row.currentEnrollmentPeriodId);
    const detail = await getEnrollment(world, row.enrollmentId);
    expect(detail.periods).toHaveLength(2);
    const next = detail.periods[1];
    if (next === undefined) throw new Error("Missing advance period");
    await runTwice(world.organizationA, next.periodStartsOn, ENROLLMENT_JOB.RENEW);
    expect((await getEnrollment(world, row.enrollmentId)).currentEnrollmentPeriodId).toBe(
      next.enrollmentPeriodId,
    );
    expect(
      await harness.connections.platform.collection("outbox_events").countDocuments({
        organizationId: world.organizationA,
        type: ENROLLMENT_EVENT_TYPE.ENROLLMENT_RENEWED,
      }),
    ).toBe(1);
  });
  it("expires an archived plan and renews the later member of the same organization", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    const firstPlan = await publishPlan(world, { billingPeriod: { unit: "DAY", count: 1 } });
    const secondPlan = await publishPlan(world, { billingPeriod: { unit: "DAY", count: 1 } });
    const contactId = await contact(world);
    const first = await enroll(world, {
      ...firstPlan,
      contactId,
      startsOn: addDays(today(harness), -1),
      autoRenew: true,
    });
    const second = await enroll(world, {
      ...secondPlan,
      contactId,
      startsOn: addDays(today(harness), -1),
      autoRenew: true,
    });
    await harness.connections.tenantShared
      .collection("offerings")
      .updateOne(
        { organizationId: world.organizationA, offeringId: firstPlan.offeringId },
        { $set: { status: "ARCHIVED" } },
      );
    await runTwice(world.organizationA, today(harness), ENROLLMENT_JOB.RENEW);
    expect((await getEnrollment(world, (first.body.data as Enrollment).enrollmentId)).status).toBe(
      "EXPIRED",
    );
    expect(
      (await getEnrollment(world, (second.body.data as Enrollment).enrollmentId)).periods,
    ).toHaveLength(2);
  });
  it("activates a future-start enrollment on its start date once", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    const plan = await publishPlan(world);
    const startsOn = addDays(today(harness), 1);
    const created = await enroll(world, { ...plan, contactId: await contact(world), startsOn });
    const row = created.body.data as Enrollment;
    expect(row.status).toBe("PENDING");
    await runTwice(world.organizationA, startsOn, ENROLLMENT_JOB.RENEW);
    expect((await getEnrollment(world, row.enrollmentId)).status).toBe("ACTIVE");
    expect(
      await harness.connections.platform.collection("outbox_events").countDocuments({
        organizationId: world.organizationA,
        type: ENROLLMENT_EVENT_TYPE.ENROLLMENT_ACTIVATED,
      }),
    ).toBe(1);
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

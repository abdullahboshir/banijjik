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
import {
  publishPlan,
  contact,
  enroll,
  today,
  setting,
  getEnrollment,
  action,
} from "../test-support/enrollment-api-world.js";
import { addDays } from "../domain/period-dates.js";
import type { Enrollment } from "../domain/enrollment.entity.js";

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
});

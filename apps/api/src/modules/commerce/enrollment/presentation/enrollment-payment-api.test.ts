import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type EventEnvelope, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import {
  ENROLLMENT_EVENT_TYPE,
  ENROLLMENT_JOB,
  ENROLLMENT_RULE_KEY,
  ENROLLMENT_SETTING,
} from "@banijjik/contracts/enrollment";
import { PAYMENT_EVENT_TYPE, PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { newId } from "@banijjik/ids";
import { businessDateOf } from "../../booking/index.js";
import {
  memberWithRole,
  money,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";
import { withOrganizationContext } from "../../../../test-support/organization-context.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import { EventHandlerRegistry } from "../../../../kernel/events/event-handler-registry.js";
import { runEventHandler } from "../../../../kernel/events/handler-runner.js";
import { buildModuleRegistry } from "../../../../routes/module-registry.js";
import {
  buildOrganizationConfigPorts,
  buildResolvedConfigSources,
} from "../../../../routes/organization-config-ports.js";
import {
  buildEnrollmentWorkerJobs,
  buildEnrollmentWorkerRuntime,
} from "../../../../routes/enrollment-worker-jobs.js";
import { buildOrgConfigService } from "../../../platform/entitlement/index.js";
import { buildIndustryTemplateReader } from "../../../platform/industry/index.js";
import { buildSyncEnrollmentPaymentsHandler } from "../index.js";
import { addDays } from "../domain/period-dates.js";
import type { Enrollment, EnrollmentPeriod } from "../domain/enrollment.entity.js";

registerIamApiModels();
let harness: IamApiHarness;
beforeAll(async () => {
  harness = await startCatalogApi();
  /** 02:00 on 1 March in Dhaka, the fixed clock of the enrollment suites. */
  harness.clock.advanceSeconds(
    (new Date("2026-03-01T02:00:00+06:00").getTime() - harness.clock.now().getTime()) / 1000,
  );
});
afterAll(async () => {
  await harness.dispose();
});
const RETAIL = { industryTemplateKey: "RETAIL" };
const GYM = { industryTemplateKey: "GYM" };

/** A worker at a fixed Dhaka morning: its jobs and its sync handler all use this clock. */
function workerAt(date: string) {
  const now = new Date(`${date}T02:00:00+06:00`);
  const clock = { now: () => now };
  const registry = buildModuleRegistry();
  const orgConfig = buildOrgConfigService({
    registry,
    clock,
    ...buildOrganizationConfigPorts(),
    ...buildResolvedConfigSources(registry),
    templates: buildIndustryTemplateReader(clock),
  });
  return {
    now,
    jobs: buildEnrollmentWorkerJobs({ clock, registry, orgConfig }),
    dependencies: buildEnrollmentWorkerRuntime({ clock, registry, orgConfig }),
  };
}

async function runJobAt(organizationId: string, date: string, key: string): Promise<void> {
  const { jobs, now } = workerAt(date);
  const job = jobs.find((entry) => entry.jobKey === key);
  if (job === undefined) throw new Error("Missing job");
  await withOrganizationContext(organizationId, () => job.run(organizationId, now));
}

function makeEnvelope(
  organizationId: string,
  type: string,
  paymentId: string,
): EventEnvelope<{ paymentId: string }> {
  return {
    eventId: newId(),
    type: type as EventEnvelope<{ paymentId: string }>["type"],
    version: 1,
    occurredAt: new Date().toISOString(),
    organizationId,
    actorUserId: null,
    payload: { paymentId },
  };
}

/** Runs the real `enrollment.syncPayments` handler as the worker would for this payment event. */
async function syncPayments(organizationId: string, date: string, type: string, paymentId: string) {
  const handler = buildSyncEnrollmentPaymentsHandler(workerAt(date).dependencies);
  await withOrganizationContext(organizationId, () =>
    handler.handle(makeEnvelope(organizationId, type, paymentId)),
  );
  return handler;
}

interface PaymentCaller {
  readonly actor: TwoOrganizations["alice"];
  readonly organizationId: string;
  readonly locationId: string;
}

function payAt(
  caller: PaymentCaller,
  enrollmentPeriodId: string,
  amount: number,
  options: { refund?: boolean; key?: string } = {},
) {
  return caller.actor.callWith({
    method: "post",
    path: `/orgs/${caller.organizationId}/${options.refund ? "refunds" : "payments"}`,
    idempotencyKey: options.key ?? newId(),
    body: {
      locationId: caller.locationId,
      method: "CASH",
      amount: money(amount),
      allocations: [
        {
          requestType: PAYMENT_REQUEST_TYPE.ENROLLMENT,
          requestId: enrollmentPeriodId,
          amount: money(amount),
        },
      ],
    },
  });
}

function pay(world: TwoOrganizations, enrollmentPeriodId: string, amount: number, refund = false) {
  return payAt(
    { actor: world.alice, organizationId: world.organizationA, locationId: world.locationA1 },
    enrollmentPeriodId,
    amount,
    { refund },
  );
}

async function paidOutboxEventId(
  world: TwoOrganizations,
  type: string,
  paymentId: string,
): Promise<string> {
  const row = await harness.connections.platform.collection("outbox_events").findOne({
    organizationId: world.organizationA,
    type,
    "payload.paymentId": paymentId,
  });
  if (row === null) throw new Error("the payment event was not written");
  return row.eventId as string;
}

type EnrollmentDetail = Enrollment & { periods: EnrollmentPeriod[] };

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

async function activatedCount(world: TwoOrganizations, enrollmentId: string): Promise<number> {
  return harness.connections.platform.collection("outbox_events").countDocuments({
    organizationId: world.organizationA,
    type: ENROLLMENT_EVENT_TYPE.ENROLLMENT_ACTIVATED,
    "payload.enrollmentId": enrollmentId,
  });
}

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

async function contact(world: TwoOrganizations): Promise<string> {
  const response = await world.alice.call("post", `/orgs/${world.organizationA}/contacts`, {
    name: "Member",
    contactType: "PERSON",
    contactRoles: ["RELATED"],
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

function today(): string {
  return businessDateOf(harness.clock.now(), "Asia/Dhaka");
}

async function enroll(world: TwoOrganizations, body: object): Promise<Enrollment> {
  const response = await world.alice.callWith({
    method: "post",
    path: `/orgs/${world.organizationA}/enrollments`,
    idempotencyKey: newId(),
    body: { locationId: world.locationA1, contactId: await contact(world), ...body },
  });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body.data as Enrollment;
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

async function dues(world: TwoOrganizations): Promise<Record<string, unknown>[]> {
  const response = await world.alice.call(
    "get",
    `/orgs/${world.organizationA}/dues?requestType=${PAYMENT_REQUEST_TYPE.ENROLLMENT}`,
  );
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return response.body.data as Record<string, unknown>[];
}

async function summaryRow(world: TwoOrganizations, enrollmentPeriodId: string) {
  return harness.connections.tenantShared.collection("payment_summaries").findOne({
    organizationId: world.organizationA,
    requestType: PAYMENT_REQUEST_TYPE.ENROLLMENT,
    requestId: enrollmentPeriodId,
  });
}

describe("paying an enrollment period", () => {
  it("moves the period through PARTIAL to PAID and activates the enrollment on the full payment", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    const plan = await publishPlan(world, { admissionFee: { amount: 999, currency: "BDT" } });
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    const first = (await getEnrollment(world, enrollment.enrollmentId)).periods[0];
    if (first === undefined) throw new Error("Missing first period");
    expect(first.fee.amount).toBe(11000);
    const partial = await pay(world, first.enrollmentPeriodId, 5000);
    expect(partial.status, JSON.stringify(partial.body)).toBe(201);
    await syncPayments(
      world.organizationA,
      today(),
      PAYMENT_EVENT_TYPE.PAYMENT_RECEIVED,
      partial.body.data.paymentId,
    );
    let detail = await getEnrollment(world, enrollment.enrollmentId);
    expect(detail.periods[0]?.status).toBe("PARTIAL");
    expect(detail.status).toBe("PENDING");
    const rest = await pay(world, first.enrollmentPeriodId, 6000);
    expect(rest.status).toBe(201);
    await syncPayments(
      world.organizationA,
      today(),
      PAYMENT_EVENT_TYPE.PAYMENT_RECEIVED,
      rest.body.data.paymentId,
    );
    detail = await getEnrollment(world, enrollment.enrollmentId);
    expect(detail.periods[0]?.status).toBe("PAID");
    expect(detail.status).toBe("ACTIVE");
    expect(await activatedCount(world, enrollment.enrollmentId)).toBe(1);
  });

  it("activates on a staff action right after the payment, before the handler ran", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    const first = (await getEnrollment(world, enrollment.enrollmentId)).periods[0];
    if (first === undefined) throw new Error("Missing first period");
    expect((await pay(world, first.enrollmentPeriodId, 10001)).status).toBe(201);
    const activated = await action(world, enrollment, "activate");
    expect(activated.status).toBe("ACTIVE");
    expect((await getEnrollment(world, enrollment.enrollmentId)).periods[0]?.status).toBe("PAID");
  });

  it("holds a paid future-start enrollment until the renew job reaches its start date", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    const plan = await publishPlan(world);
    const startsOn = addDays(today(), 1);
    const paidOne = await enroll(world, { ...plan, startsOn, autoRenew: false });
    const unpaidOne = await enroll(world, { ...plan, startsOn, autoRenew: false });
    const first = (await getEnrollment(world, paidOne.enrollmentId)).periods[0];
    if (first === undefined) throw new Error("Missing first period");
    expect((await pay(world, first.enrollmentPeriodId, 10001)).status).toBe(201);
    await runJobAt(world.organizationA, startsOn, ENROLLMENT_JOB.RENEW);
    expect((await getEnrollment(world, paidOne.enrollmentId)).status).toBe("ACTIVE");
    expect((await getEnrollment(world, unpaidOne.enrollmentId)).status).toBe("PENDING");
  });

  it("brings an overdue enrollment back to ACTIVE when its current period is paid", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    const plan = await publishPlan(world);
    const active = await enroll(world, { ...plan, startsOn: addDays(today(), -6) });
    expect(active.status).toBe("ACTIVE");
    await runJobAt(world.organizationA, today(), ENROLLMENT_JOB.OVERDUE);
    expect((await getEnrollment(world, active.enrollmentId)).status).toBe("OVERDUE");
    const current = (await getEnrollment(world, active.enrollmentId)).periods[0];
    if (current === undefined) throw new Error("Missing current period");
    const payment = await pay(world, current.enrollmentPeriodId, 10001);
    expect(payment.status).toBe(201);
    await syncPayments(
      world.organizationA,
      today(),
      PAYMENT_EVENT_TYPE.PAYMENT_RECEIVED,
      payment.body.data.paymentId,
    );
    const detail = await getEnrollment(world, active.enrollmentId);
    expect(detail.status).toBe("ACTIVE");
    expect(detail.periods[0]?.status).toBe("PAID");
  });

  it("does not mark overdue a period that was paid moments before the job", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    const plan = await publishPlan(world);
    const active = await enroll(world, { ...plan, startsOn: addDays(today(), -6) });
    expect(active.status).toBe("ACTIVE");
    const current = (await getEnrollment(world, active.enrollmentId)).periods[0];
    if (current === undefined) throw new Error("Missing current period");
    expect((await pay(world, current.enrollmentPeriodId, 10001)).status).toBe(201);
    await runJobAt(world.organizationA, today(), ENROLLMENT_JOB.OVERDUE);
    const detail = await getEnrollment(world, active.enrollmentId);
    expect(detail.status).toBe("ACTIVE");
    expect(detail.periods[0]?.status).toBe("PAID");
  });

  it("lowers a refunded period to PARTIAL and keeps the enrollment ACTIVE", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    const first = (await getEnrollment(world, enrollment.enrollmentId)).periods[0];
    if (first === undefined) throw new Error("Missing first period");
    const payment = await pay(world, first.enrollmentPeriodId, 10001);
    await syncPayments(
      world.organizationA,
      today(),
      PAYMENT_EVENT_TYPE.PAYMENT_RECEIVED,
      payment.body.data.paymentId,
    );
    expect((await getEnrollment(world, enrollment.enrollmentId)).status).toBe("ACTIVE");
    const refund = await pay(world, first.enrollmentPeriodId, 4000, true);
    expect(refund.status, JSON.stringify(refund.body)).toBe(201);
    await syncPayments(
      world.organizationA,
      today(),
      PAYMENT_EVENT_TYPE.PAYMENT_REFUNDED,
      refund.body.data.paymentId,
    );
    const detail = await getEnrollment(world, enrollment.enrollmentId);
    expect(detail.periods[0]?.status).toBe("PARTIAL");
    expect(detail.status).toBe("ACTIVE");
  });

  it("changes nothing when the same payment is synced twice", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    const first = (await getEnrollment(world, enrollment.enrollmentId)).periods[0];
    if (first === undefined) throw new Error("Missing first period");
    const payment = await pay(world, first.enrollmentPeriodId, 10001);
    const handler = await syncPayments(
      world.organizationA,
      today(),
      PAYMENT_EVENT_TYPE.PAYMENT_RECEIVED,
      payment.body.data.paymentId,
    );
    const afterFirst = await getEnrollment(world, enrollment.enrollmentId);
    await withOrganizationContext(world.organizationA, () =>
      handler.handle(
        makeEnvelope(
          world.organizationA,
          PAYMENT_EVENT_TYPE.PAYMENT_RECEIVED,
          payment.body.data.paymentId,
        ),
      ),
    );
    expect(await getEnrollment(world, enrollment.enrollmentId)).toEqual(afterFirst);
    expect(await activatedCount(world, enrollment.enrollmentId)).toBe(1);
  });

  it("skips the handler while the enrollment module is off and applies the event exactly once when it is on", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    const first = (await getEnrollment(world, enrollment.enrollmentId)).periods[0];
    if (first === undefined) throw new Error("Missing first period");
    const payment = await pay(world, first.enrollmentPeriodId, 10001);
    const handler = buildSyncEnrollmentPaymentsHandler(workerAt(today()).dependencies);
    const registry = new EventHandlerRegistry();
    registry.register(handler);
    const job = {
      eventId: await paidOutboxEventId(
        world,
        PAYMENT_EVENT_TYPE.PAYMENT_RECEIVED,
        payment.body.data.paymentId,
      ),
      handlerKey: handler.handlerKey,
      type: PAYMENT_EVENT_TYPE.PAYMENT_RECEIVED,
      organizationId: world.organizationA,
    };
    const effectiveness = (isOn: boolean) => ({ isEffective: async () => isOn });
    expect(await runEventHandler(job, registry, effectiveness(false))).toBe("SKIPPED_MODULE_OFF");
    expect((await getEnrollment(world, enrollment.enrollmentId)).status).toBe("PENDING");
    expect(await runEventHandler(job, registry, effectiveness(true))).toBe("HANDLED");
    expect((await getEnrollment(world, enrollment.enrollmentId)).status).toBe("ACTIVE");
    expect(await runEventHandler(job, registry, effectiveness(true))).toBe("ALREADY_PROCESSED");
  });

  it("refuses to sync a period whose payments were recorded in another currency", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    const first = (await getEnrollment(world, enrollment.enrollmentId)).periods[0];
    if (first === undefined) throw new Error("Missing first period");
    expect((await pay(world, first.enrollmentPeriodId, 10001)).status).toBe(201);
    await harness.connections.tenantShared
      .collection("payment_summaries")
      .updateOne(
        { organizationId: world.organizationA, requestId: first.enrollmentPeriodId },
        { $set: { "total.currency": "USD", "allocated.currency": "USD" } },
      );
    const response = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/enrollments/${enrollment.enrollmentId}/activate`,
      { version: enrollment.version },
    );
    expect(response.status, JSON.stringify(response.body)).toBe(422);
    expect(response.body.error.messageKey).toBe(ENROLLMENT_RULE_KEY.CURRENCY_MISMATCH);
    expect((await getEnrollment(world, enrollment.enrollmentId)).status).toBe("PENDING");
  });
});

describe("the ENROLLMENT request reader", () => {
  it("refuses a missing, waived or cancelled period and another organization's period", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    expect((await pay(world, newId(), 100)).status).toBe(400);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    const first = (await getEnrollment(world, enrollment.enrollmentId)).periods[0];
    if (first === undefined) throw new Error("Missing first period");
    await harness.connections.tenantShared
      .collection("enrollment_periods")
      .updateOne(
        { organizationId: world.organizationA, enrollmentPeriodId: first.enrollmentPeriodId },
        { $set: { status: "WAIVED" } },
      );
    expect((await pay(world, first.enrollmentPeriodId, 100)).status).toBe(400);
    await harness.connections.tenantShared
      .collection("enrollment_periods")
      .updateOne(
        { organizationId: world.organizationA, enrollmentPeriodId: first.enrollmentPeriodId },
        { $set: { status: "OPEN" } },
      );
    const foreign = await payAt(
      { actor: world.bob, organizationId: world.organizationB, locationId: world.locationB1 },
      first.enrollmentPeriodId,
      100,
    );
    expect(foreign.status).toBe(400);
    const cancelled = await action(world, enrollment, "cancel");
    expect((await pay(world, cancelled.currentEnrollmentPeriodId, 100)).status).toBe(400);
  });

  it("collects a debt of an expired enrollment", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    const plan = await publishPlan(world);
    const active = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    expect(active.status).toBe("ACTIVE");
    await runJobAt(world.organizationA, "2026-04-01", ENROLLMENT_JOB.RENEW);
    expect((await getEnrollment(world, active.enrollmentId)).status).toBe("EXPIRED");
    const first = (await getEnrollment(world, active.enrollmentId)).periods[0];
    if (first === undefined) throw new Error("Missing first period");
    expect((await pay(world, first.enrollmentPeriodId, 10001)).status).toBe(201);
    expect((await summaryRow(world, first.enrollmentPeriodId))?.["allocated"]).toEqual(
      money(10001),
    );
  });

  it("holds every enrollment payment in BEFORE_REVENUE", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    const first = (await getEnrollment(world, enrollment.enrollmentId)).periods[0];
    if (first === undefined) throw new Error("Missing first period");
    const payment = await pay(world, first.enrollmentPeriodId, 10001);
    expect(payment.status).toBe(201);
    expect(payment.body.data.allocations[0].requestType).toBe(PAYMENT_REQUEST_TYPE.ENROLLMENT);
    expect(payment.body.data.allocations[0].revenueState).toBe("BEFORE_REVENUE");
  });

  it("recreates a deleted summary with the period fee on the first payment", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    const first = (await getEnrollment(world, enrollment.enrollmentId)).periods[0];
    if (first === undefined) throw new Error("Missing first period");
    await harness.connections.tenantShared
      .collection("payment_summaries")
      .deleteOne({ organizationId: world.organizationA, requestId: first.enrollmentPeriodId });
    expect((await pay(world, first.enrollmentPeriodId, 500)).status).toBe(201);
    const summary = await summaryRow(world, first.enrollmentPeriodId);
    expect(summary?.["total"]).toEqual(money(10001));
    expect(summary?.["allocated"]).toEqual(money(500));
  });
});

describe("enrollment dues", () => {
  it("lists each period's fee with the bill-to contact and clears what was never paid on cancellation", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    expect(enrollment.status).toBe("ACTIVE");
    const detail = await getEnrollment(world, enrollment.enrollmentId);
    const rows = await dues(world);
    expect(rows.map((row) => row.requestId)).toContain(detail.periods[0]?.enrollmentPeriodId);
    expect(rows[0]).toMatchObject({
      total: money(10001),
      contactId: detail.billToContactId,
      locationId: world.locationA1,
    });
    const renewed = await action(world, enrollment, "renew");
    const afterRenewal = await getEnrollment(world, renewed.enrollmentId);
    const second = afterRenewal.periods[1];
    if (second === undefined) throw new Error("Missing advance period");
    expect((await dues(world)).map((row) => row.requestId)).toContain(second.enrollmentPeriodId);
    if (detail.periods[0] === undefined) throw new Error("Missing first period");
    expect((await pay(world, detail.periods[0].enrollmentPeriodId, 500)).status).toBe(201);
    expect((await action(world, renewed, "cancel")).status).toBe("CANCELLED");
    expect(await dues(world)).toEqual([]);
  });
});

describe("enrollment payment boundaries", () => {
  it("refuses a viewer, invalid input, another organization and another location", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    const first = (await getEnrollment(world, enrollment.enrollmentId)).periods[0];
    if (first === undefined) throw new Error("Missing first period");
    const viewer = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.VIEWER);
    expect(
      (
        await payAt(
          { actor: viewer, organizationId: world.organizationA, locationId: world.locationA1 },
          first.enrollmentPeriodId,
          100,
        )
      ).status,
    ).toBe(403);
    expect((await pay(world, first.enrollmentPeriodId, -1)).status).toBe(400);
    expect(
      (
        await payAt(
          { actor: world.bob, organizationId: world.organizationB, locationId: world.locationB1 },
          first.enrollmentPeriodId,
          100,
        )
      ).status,
    ).toBe(400);
    const roleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const member = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA2, roleId },
    ]);
    expect(
      (
        await payAt(
          {
            actor: member.actor,
            organizationId: world.organizationA,
            locationId: world.locationA2,
          },
          first.enrollmentPeriodId,
          100,
        )
      ).status,
    ).toBe(400);
    expect((await pay(world, first.enrollmentPeriodId, 500)).status).toBe(201);
    expect(
      (
        await payAt(
          {
            actor: member.actor,
            organizationId: world.organizationA,
            locationId: world.locationA2,
          },
          first.enrollmentPeriodId,
          500,
          { refund: true },
        )
      ).status,
    ).toBe(400);
  });
});

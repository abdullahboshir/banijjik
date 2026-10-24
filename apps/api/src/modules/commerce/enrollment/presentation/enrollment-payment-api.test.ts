import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { EVENT_TYPE, type EventEnvelope, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import {
  JOURNAL_SOURCE_TYPE,
  REVENUE_STATE,
  SYSTEM_ACCOUNT_CODE,
  type PostingKey,
  POSTING_KEY,
} from "@banijjik/contracts/accounting";
import {
  ENROLLMENT_EVENT_TYPE,
  ENROLLMENT_JOB,
  ENROLLMENT_RULE_KEY,
  ENROLLMENT_SETTING,
} from "@banijjik/contracts/enrollment";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import {
  CLOSED_REQUEST_REVERSAL_POLICY,
  PAYMENT_EVENT_TYPE,
  PAYMENT_REQUEST_TYPE,
  PAYMENT_REVERSAL_CLOSED_REQUEST_SETTING_KEY,
} from "@banijjik/contracts/payment";
import { asId, newId, type OrganizationId } from "@banijjik/ids";
import { businessDateOf } from "../../booking/index.js";
import {
  buildPostEnrollmentsHandler,
  buildPostPaymentsHandler,
  MongoAccountRepository,
  MongoJournalRepository,
  seedSystemAccounts,
} from "../../accounting/index.js";
import {
  buildPaymentPostingSourceAdapter,
  buildRequestAdvanceReader,
  MongoPaymentSummaryRepository,
} from "../../payment/index.js";
import { buildPaymentRequestReaders } from "../../../../routes/payment-request-readers.js";
import { kernelEventPublisher } from "../../../../kernel/events/index.js";
import { getActiveSession, models, MongoUnitOfWork } from "../../../../kernel/db/index.js";

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
import {
  buildEnrollmentPeriodPostingSource,
  buildSyncEnrollmentPaymentsHandler,
  MongoEnrollmentRepository,
} from "../index.js";

/** The stored name of the period model (kernel models accessor), kept as a literal here. */
const ENROLLMENT_PERIOD_MODEL = "EnrollmentPeriod";
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

async function reversePayment(world: TwoOrganizations, paymentId: string, amount: number) {
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
  expect(granted.status, JSON.stringify(granted.body)).toBe(200);
  return world.alice.callWith({
    method: "post",
    path: `/orgs/${world.organizationA}/payments/${paymentId}/reverse`,
    idempotencyKey: newId(),
    body: { approvalToken: granted.body.data.approvalToken },
  });
}

/** A period part-paid with 500, then the enrollment cancelled: the cancellation keeps the 500. */
async function cancelledEnrollmentWithPartPaid(world: TwoOrganizations) {
  await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
  const plan = await publishPlan(world);
  const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
  const period = (await getEnrollment(world, enrollment.enrollmentId)).periods[0];
  if (period === undefined) throw new Error("Missing first period");
  const payment = await pay(world, period.enrollmentPeriodId, 500);
  expect(payment.status, JSON.stringify(payment.body)).toBe(201);
  expect((await action(world, enrollment, "cancel")).status).toBe("CANCELLED");
  expect(await dues(world)).toEqual([]);
  return { periodId: period.enrollmentPeriodId, paymentId: payment.body.data.paymentId as string };
}

describe("an enrollment payment reversed after the enrollment was cancelled", () => {
  it("default REOPEN_DUE, enrollment: the period shows in dues with the kept amount", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    const { periodId, paymentId } = await cancelledEnrollmentWithPartPaid(world);

    const reversed = await reversePayment(world, paymentId, 500);

    expect(reversed.status, JSON.stringify(reversed.body)).toBe(201);
    expect(reversed.body.data.writeOffs).toEqual([]);
    const rows = await dues(world);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ requestId: periodId, due: money(500) });
  });

  it("WRITE_OFF, enrollment: the period leaves dues and the reversal records the amount", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await setting(
      world,
      PAYMENT_REVERSAL_CLOSED_REQUEST_SETTING_KEY,
      CLOSED_REQUEST_REVERSAL_POLICY.WRITE_OFF,
    );
    const { periodId, paymentId } = await cancelledEnrollmentWithPartPaid(world);

    const reversed = await reversePayment(world, paymentId, 500);

    expect(reversed.status, JSON.stringify(reversed.body)).toBe(201);
    expect(reversed.body.data.writeOffs).toEqual([
      { requestType: PAYMENT_REQUEST_TYPE.ENROLLMENT, requestId: periodId, amount: money(500) },
    ]);
    expect(await dues(world)).toEqual([]);
    expect((await summaryRow(world, periodId))?.["total"]).toEqual(money(0));
  });
});

type JournalQuery = Parameters<MongoJournalRepository["findBySource"]>[0];
type JournalLine = { accountCode: string; debit: { amount: number }; credit: { amount: number } };
type PeriodEventRow = { eventId: string; type: string; payload: Record<string, unknown> };

const PERIOD_REVENUE_EVENT_TYPES = [
  ENROLLMENT_EVENT_TYPE.PERIOD_REVENUE_RECOGNIZED,
  ENROLLMENT_EVENT_TYPE.PERIOD_REVENUE_CLOSED,
];

function postingDependencies() {
  return {
    accounts: new MongoAccountRepository(),
    journals: new MongoJournalRepository(),
    events: kernelEventPublisher,
    audit: { record: async () => undefined },
    clock: harness.clock,
  };
}

async function seedAccountsFor(world: TwoOrganizations): Promise<void> {
  await withOrganizationContext(world.organizationA, () =>
    seedSystemAccounts(
      { accounts: new MongoAccountRepository(), clock: harness.clock },
      { organizationId: asId<OrganizationId>(world.organizationA), actorUserId: null },
    ),
  );
}

/** Period-revenue outbox rows of one period, oldest first. */
async function periodEventRows(
  world: TwoOrganizations,
  enrollmentPeriodId: string,
): Promise<PeriodEventRow[]> {
  const rows = await harness.connections.platform
    .collection("outbox_events")
    .find({
      organizationId: world.organizationA,
      type: { $in: [...PERIOD_REVENUE_EVENT_TYPES] },
      "payload.enrollmentPeriodId": enrollmentPeriodId,
    })
    .sort({ _id: 1 })
    .toArray();
  return rows as unknown as PeriodEventRow[];
}

/** Runs the real enrollment-posting handler for every period event of the organization, in order. */
async function postEnrollmentEvents(world: TwoOrganizations): Promise<void> {
  const handler = buildPostEnrollmentsHandler({
    enrollments: buildEnrollmentPeriodPostingSource(buildRequestAdvanceReader()),
    posting: postingDependencies(),
  });
  const rows = await harness.connections.platform
    .collection("outbox_events")
    .find({ organizationId: world.organizationA, type: { $in: [...PERIOD_REVENUE_EVENT_TYPES] } })
    .sort({ _id: 1 })
    .toArray();
  for (const row of rows) {
    await withOrganizationContext(world.organizationA, () =>
      new MongoUnitOfWork().run(() =>
        handler.handle({
          eventId: row.eventId as string,
          type: row.type as string,
          version: 1,
          occurredAt: harness.clock.now().toISOString(),
          organizationId: world.organizationA,
          actorUserId: null,
          payload: row.payload,
        } as unknown as EventEnvelope<never>),
      ),
    );
  }
}

/** Runs the real payment-posting handler for one payment event (received or reversed). */
async function postPaymentEvent(world: TwoOrganizations, type: string, paymentId: string) {
  const handler = buildPostPaymentsHandler({
    payments: buildPaymentPostingSourceAdapter(buildPaymentRequestReaders()),
    posting: postingDependencies(),
  });
  await withOrganizationContext(world.organizationA, () =>
    new MongoUnitOfWork().run(() =>
      handler.handle({
        eventId: newId(),
        type,
        version: 1,
        occurredAt: harness.clock.now().toISOString(),
        organizationId: world.organizationA,
        actorUserId: null,
        payload: { paymentId },
      } as unknown as EventEnvelope<never>),
    ),
  );
}

async function journalOf(world: TwoOrganizations, query: JournalQuery) {
  return withOrganizationContext(world.organizationA, () =>
    new MongoJournalRepository().findBySource(query),
  );
}

function periodJournal(
  world: TwoOrganizations,
  enrollmentPeriodId: string,
  postingKey: PostingKey,
) {
  return journalOf(world, {
    sourceType: JOURNAL_SOURCE_TYPE.ENROLLMENT,
    sourceId: enrollmentPeriodId,
    postingKey,
  });
}

function lineAmount(
  journal: { readonly lines: readonly JournalLine[] } | undefined,
  accountCode: string,
  side: "debit" | "credit",
): number {
  return journal?.lines.find((line) => line.accountCode === accountCode)?.[side].amount ?? 0;
}

/** Net debit minus credit of one account across the journals of the organization. */
async function netBalance(world: TwoOrganizations, accountCode: string): Promise<number> {
  const page = await withOrganizationContext(world.organizationA, () =>
    new MongoJournalRepository().list({ page: 1, limit: 100 }),
  );
  let net = 0;
  for (const entry of page.items) {
    for (const line of entry.lines as readonly JournalLine[]) {
      if (line.accountCode === accountCode) net += line.debit.amount - line.credit.amount;
    }
  }
  return net;
}

async function periodAt(world: TwoOrganizations, enrollmentId: string, index: number) {
  const detail = await getEnrollment(world, enrollmentId);
  const period = detail.periods[index];
  if (period === undefined) throw new Error(`Missing period ${index}`);
  return period;
}

/** Pauses the first payment right before its summary write, so a recognition can run in between. */
function pauseFirstAllocation() {
  const original = MongoPaymentSummaryRepository.prototype.applyAllocation;
  let release!: () => void;
  const mayWrite = new Promise<void>((resolve) => {
    release = resolve;
  });
  let signalPaused!: () => void;
  const paused = new Promise<void>((resolve) => {
    signalPaused = resolve;
  });
  let gated = false;
  const spy = vi
    .spyOn(MongoPaymentSummaryRepository.prototype, "applyAllocation")
    .mockImplementation(async function (
      this: MongoPaymentSummaryRepository,
      input: Parameters<MongoPaymentSummaryRepository["applyAllocation"]>[0],
    ) {
      if (!gated) {
        gated = true;
        signalPaused();
        await mayWrite;
      }
      return original.call(this, input);
    });
  return { paused, release, restore: () => spy.mockRestore() };
}

describe("enrollment period revenue (card 3.31)", () => {
  it("activating an enrollment recognises its started period on the activation date", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await seedAccountsFor(world);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    const period = await periodAt(world, enrollment.enrollmentId, 0);
    const payment = await pay(world, period.enrollmentPeriodId, 10001);
    expect(payment.status, JSON.stringify(payment.body)).toBe(201);
    expect((await action(world, enrollment, "activate")).status).toBe("ACTIVE");
    await postPaymentEvent(world, EVENT_TYPE.PAYMENT_RECEIVED, payment.body.data.paymentId);
    await postEnrollmentEvents(world);
    const revenue = await periodJournal(
      world,
      period.enrollmentPeriodId,
      POSTING_KEY.enrollment_period_revenue,
    );
    expect(revenue?.businessDate).toBe(today());
    expect(lineAmount(revenue, SYSTEM_ACCOUNT_CODE.REVENUE_PLAN, "credit")).toBe(10001);
    const settle = await periodJournal(
      world,
      period.enrollmentPeriodId,
      POSTING_KEY.enrollment_period_advance_settle,
    );
    expect(lineAmount(settle, SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES, "debit")).toBe(10001);
    expect(await netBalance(world, SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES)).toBe(0);
    expect(await netBalance(world, SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE)).toBe(0);
  });

  it("a PENDING enrollment past its start date has no revenue", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    const period = await periodAt(world, enrollment.enrollmentId, 0);
    await runJobAt(world.organizationA, addDays(today(), 2), ENROLLMENT_JOB.RENEW);
    expect((await getEnrollment(world, enrollment.enrollmentId)).status).toBe("PENDING");
    expect(await periodEventRows(world, period.enrollmentPeriodId)).toEqual([]);
  });

  it("renewal recognises the new period on its start date, not the run date", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    await seedAccountsFor(world);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: true });
    const first = await periodAt(world, enrollment.enrollmentId, 0);
    const runDate = addDays(first.periodEndsOn, 3);
    await runJobAt(world.organizationA, runDate, ENROLLMENT_JOB.RENEW);
    const second = await periodAt(world, enrollment.enrollmentId, 1);
    const rows = await periodEventRows(world, second.enrollmentPeriodId);
    expect(rows.map((row) => row.type)).toEqual([ENROLLMENT_EVENT_TYPE.PERIOD_REVENUE_RECOGNIZED]);
    await postEnrollmentEvents(world);
    const revenue = await periodJournal(
      world,
      second.enrollmentPeriodId,
      POSTING_KEY.enrollment_period_revenue,
    );
    expect(revenue?.businessDate).toBe(addDays(first.periodEndsOn, 1));
    expect(revenue?.businessDate).not.toBe(runDate);
  });

  it("an advance period paid early is recognised only when it becomes current", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    const first = await periodAt(world, enrollment.enrollmentId, 0);
    const renewed = await action(world, enrollment, "renew");
    const advance = await periodAt(world, renewed.enrollmentId, 1);
    expect(await periodEventRows(world, advance.enrollmentPeriodId)).toEqual([]);
    expect((await pay(world, advance.enrollmentPeriodId, 10001)).status).toBe(201);
    expect(await periodEventRows(world, advance.enrollmentPeriodId)).toEqual([]);
    await runJobAt(world.organizationA, addDays(first.periodEndsOn, 1), ENROLLMENT_JOB.RENEW);
    const rows = await periodEventRows(world, advance.enrollmentPeriodId);
    expect(rows.map((row) => row.type)).toEqual([ENROLLMENT_EVENT_TYPE.PERIOD_REVENUE_RECOGNIZED]);
  });

  it("a payment after recognition is AFTER_REVENUE and goes to the receivable", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    await seedAccountsFor(world);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    const period = await periodAt(world, enrollment.enrollmentId, 0);
    const payment = await pay(world, period.enrollmentPeriodId, 500);
    expect(payment.status, JSON.stringify(payment.body)).toBe(201);
    expect(payment.body.data.allocations[0]?.revenueState).toBe(REVENUE_STATE.AFTER_REVENUE);
    const paymentId = payment.body.data.paymentId as string;
    await postPaymentEvent(world, EVENT_TYPE.PAYMENT_RECEIVED, paymentId);
    const received = await journalOf(world, {
      sourceType: JOURNAL_SOURCE_TYPE.PAYMENT,
      sourceId: paymentId,
      postingKey: POSTING_KEY.payment_in_after_revenue,
    });
    expect(lineAmount(received, SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, "credit")).toBe(500);
    expect(lineAmount(received, SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES, "credit")).toBe(0);
  });
});

describe("enrollment period revenue: cancel, races and replays (card 3.31)", () => {
  it("a payment paused after reading BEFORE_REVENUE conflicts with recognition; its advance is in the settle", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await seedAccountsFor(world);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    const period = await periodAt(world, enrollment.enrollmentId, 0);
    const gate = pauseFirstAllocation();
    try {
      const paymentRequest = pay(world, period.enrollmentPeriodId, 300);
      await Promise.race([gate.paused, failIfPaymentFinishedFirst(paymentRequest)]);
      await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
      expect((await action(world, enrollment, "activate")).status).toBe("ACTIVE");
      gate.release();
      const payment = await paymentRequest;
      expect(payment.status, JSON.stringify(payment.body)).toBe(201);
      const paymentId = payment.body.data.paymentId as string;
      expect(payment.body.data.allocations[0]?.revenueState).toBe(REVENUE_STATE.BEFORE_REVENUE);
      await postPaymentEvent(world, EVENT_TYPE.PAYMENT_RECEIVED, paymentId);
      await postEnrollmentEvents(world);
      const settle = await periodJournal(
        world,
        period.enrollmentPeriodId,
        POSTING_KEY.enrollment_period_advance_settle,
      );
      expect(lineAmount(settle, SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES, "debit")).toBe(300);
      const advance = await journalOf(world, {
        sourceType: JOURNAL_SOURCE_TYPE.PAYMENT,
        sourceId: paymentId,
        postingKey: POSTING_KEY.payment_in_advance,
      });
      expect(lineAmount(advance, SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES, "credit")).toBe(300);
      expect(await netBalance(world, SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES)).toBe(0);
    } finally {
      gate.release();
      gate.restore();
    }
  });

  it("cancel after recognition posts the reversal for the unpaid part, and dues and books agree", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await seedAccountsFor(world);
    const { periodId, paymentId } = await cancelledEnrollmentWithPartPaid(world);
    await postPaymentEvent(world, EVENT_TYPE.PAYMENT_RECEIVED, paymentId);
    await postEnrollmentEvents(world);
    const reversal = await periodJournal(
      world,
      periodId,
      POSTING_KEY.enrollment_period_revenue_cancel,
    );
    expect(lineAmount(reversal, SYSTEM_ACCOUNT_CODE.REVENUE_PLAN, "debit")).toBe(9501);
    expect(await netBalance(world, SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE)).toBe(0);
    expect(await dues(world)).toEqual([]);
  });

  it("cancel before the start keeps the paid advance as a cancellation fee", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await seedAccountsFor(world);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, {
      ...plan,
      startsOn: addDays(today(), 5),
      autoRenew: false,
    });
    expect(enrollment.status).toBe("PENDING");
    const period = await periodAt(world, enrollment.enrollmentId, 0);
    const payment = await pay(world, period.enrollmentPeriodId, 500);
    expect(payment.status, JSON.stringify(payment.body)).toBe(201);
    expect((await action(world, enrollment, "cancel")).status).toBe("CANCELLED");
    await postPaymentEvent(world, EVENT_TYPE.PAYMENT_RECEIVED, payment.body.data.paymentId);
    await postEnrollmentEvents(world);
    const fee = await periodJournal(
      world,
      period.enrollmentPeriodId,
      POSTING_KEY.enrollment_period_cancellation_fee,
    );
    expect(lineAmount(fee, SYSTEM_ACCOUNT_CODE.CANCELLATION_FEE_INCOME, "credit")).toBe(500);
    expect(
      await periodJournal(world, period.enrollmentPeriodId, POSTING_KEY.enrollment_period_revenue),
    ).toBeUndefined();
    expect(await netBalance(world, SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES)).toBe(0);
    expect(await netBalance(world, SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE)).toBe(0);
  });

  it("recognising twice posts once", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    await seedAccountsFor(world);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    const period = await periodAt(world, enrollment.enrollmentId, 0);
    const rows = await periodEventRows(world, period.enrollmentPeriodId);
    expect(rows.map((row) => row.type)).toEqual([ENROLLMENT_EVENT_TYPE.PERIOD_REVENUE_RECOGNIZED]);
    await postEnrollmentEvents(world);
    await postEnrollmentEvents(world);
    expect(await netBalance(world, SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE)).toBe(10001);
    expect(await netBalance(world, SYSTEM_ACCOUNT_CODE.REVENUE_PLAN)).toBe(-10001);
  });

  it("a stale period version returns 409 and posts nothing", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await seedAccountsFor(world);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    const period = await periodAt(world, enrollment.enrollmentId, 0);
    expect((await pay(world, period.enrollmentPeriodId, 10001)).status).toBe(201);
    const original = MongoEnrollmentRepository.prototype.savePeriod;
    // A concurrent writer bumps the period version right before the recognition write.
    const spy = vi
      .spyOn(MongoEnrollmentRepository.prototype, "savePeriod")
      .mockImplementation(async function (
        this: MongoEnrollmentRepository,
        toSave: EnrollmentPeriod,
        changeEnd: boolean,
      ) {
        if (toSave.revenueRecognizedOn !== undefined) {
          await withOrganizationContext(world.organizationA, () =>
            models({})
              .get(ENROLLMENT_PERIOD_MODEL)
              .updateOne(
                {
                  organizationId: world.organizationA,
                  enrollmentPeriodId: toSave.enrollmentPeriodId,
                },
                { $inc: { version: 1 } },
                bumpSessionOptions(),
              ),
          );
        }
        return original.call(this, toSave, changeEnd);
      });
    try {
      const response = await world.alice.call(
        "post",
        `/orgs/${world.organizationA}/enrollments/${enrollment.enrollmentId}/activate`,
        { version: enrollment.version },
      );
      expect(response.status, JSON.stringify(response.body)).toBe(409);
    } finally {
      spy.mockRestore();
    }
    expect((await getEnrollment(world, enrollment.enrollmentId)).status).toBe("PENDING");
    expect(await periodEventRows(world, period.enrollmentPeriodId)).toEqual([]);
    expect(
      await periodJournal(world, period.enrollmentPeriodId, POSTING_KEY.enrollment_period_revenue),
    ).toBeUndefined();
  });

  it("writing off a reversed payment on a cancelled enrollment period posts bad debt for the kept income", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await seedAccountsFor(world);
    await setting(
      world,
      PAYMENT_REVERSAL_CLOSED_REQUEST_SETTING_KEY,
      CLOSED_REQUEST_REVERSAL_POLICY.WRITE_OFF,
    );
    const { paymentId } = await cancelledEnrollmentWithPartPaid(world);
    await postPaymentEvent(world, EVENT_TYPE.PAYMENT_RECEIVED, paymentId);
    const reversed = await reversePayment(world, paymentId, 500);
    expect(reversed.status, JSON.stringify(reversed.body)).toBe(201);
    const reversalId = reversed.body.data.paymentId as string;
    await postPaymentEvent(world, EVENT_TYPE.PAYMENT_REVERSED, reversalId);
    const badDebt = await journalOf(world, {
      sourceType: JOURNAL_SOURCE_TYPE.PAYMENT,
      sourceId: reversalId,
      postingKey: POSTING_KEY.bad_debt_written_off,
    });
    expect(lineAmount(badDebt, SYSTEM_ACCOUNT_CODE.BAD_DEBT_EXPENSE, "debit")).toBe(500);
    expect(lineAmount(badDebt, SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES, "credit")).toBe(500);
  });

  it("with accounting off, recognition still writes the period event and the ordered handler skips", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    await seedAccountsFor(world);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    const period = await periodAt(world, enrollment.enrollmentId, 0);
    const [row] = await periodEventRows(world, period.enrollmentPeriodId);
    if (row === undefined) throw new Error("the recognition event was not written");
    const handler = buildPostEnrollmentsHandler({
      enrollments: buildEnrollmentPeriodPostingSource(buildRequestAdvanceReader()),
      posting: postingDependencies(),
    });
    const registry = new EventHandlerRegistry();
    registry.register(handler);
    const job = {
      eventId: row.eventId,
      handlerKey: handler.handlerKey,
      type: row.type,
      organizationId: world.organizationA,
    };
    const effectiveness = (isOn: boolean) => ({ isEffective: async () => isOn });
    expect(await runEventHandler(job, registry, effectiveness(false))).toBe("SKIPPED_MODULE_OFF");
    expect(
      await periodJournal(world, period.enrollmentPeriodId, POSTING_KEY.enrollment_period_revenue),
    ).toBeUndefined();
    // ORDERED handlers advance their position even when skipped (ADR-115), so the event is not replayed.
    expect(await runEventHandler(job, registry, effectiveness(true))).toBe("ALREADY_PROCESSED");
    expect(
      await periodJournal(world, period.enrollmentPeriodId, POSTING_KEY.enrollment_period_revenue),
    ).toBeUndefined();
  });

  it("the close event tells a period recognised at its start from one recognised at cancel even when the kept amount equals the fee", async () => {
    const started = await worldFor(harness, RETAIL, GYM);
    await setting(started, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    await seedAccountsFor(started);
    const startedPlan = await publishPlan(started);
    const startedEnrollment = await enroll(started, {
      ...startedPlan,
      startsOn: today(),
      autoRenew: false,
    });
    const startedPeriod = await periodAt(started, startedEnrollment.enrollmentId, 0);
    expect((await pay(started, startedPeriod.enrollmentPeriodId, 10001)).status).toBe(201);
    expect((await action(started, startedEnrollment, "cancel")).status).toBe("CANCELLED");
    await postEnrollmentEvents(started);
    const startedClosed = await closedRowOf(started, startedPeriod.enrollmentPeriodId);
    expect(startedClosed.payload.recognizedBeforeCancel).toBe(true);
    expect(
      await periodJournal(
        started,
        startedPeriod.enrollmentPeriodId,
        POSTING_KEY.enrollment_period_cancellation_fee,
      ),
    ).toBeUndefined();

    const cancelled = await worldFor(harness, RETAIL, GYM);
    await seedAccountsFor(cancelled);
    const cancelledPlan = await publishPlan(cancelled);
    const cancelledEnrollment = await enroll(cancelled, {
      ...cancelledPlan,
      startsOn: today(),
      autoRenew: false,
    });
    const cancelledPeriod = await periodAt(cancelled, cancelledEnrollment.enrollmentId, 0);
    expect((await pay(cancelled, cancelledPeriod.enrollmentPeriodId, 10001)).status).toBe(201);
    expect((await action(cancelled, cancelledEnrollment, "cancel")).status).toBe("CANCELLED");
    await postEnrollmentEvents(cancelled);
    const cancelledClosed = await closedRowOf(cancelled, cancelledPeriod.enrollmentPeriodId);
    expect(cancelledClosed.payload.recognizedBeforeCancel).toBe(false);
    expect(
      await periodJournal(
        cancelled,
        cancelledPeriod.enrollmentPeriodId,
        POSTING_KEY.enrollment_period_cancellation_fee,
      ),
    ).toBeDefined();
  });

  it("cancel keeps the dues total at the kept amount after the revenue touch", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    const period = await periodAt(world, enrollment.enrollmentId, 0);
    expect((await pay(world, period.enrollmentPeriodId, 500)).status).toBe(201);
    expect((await action(world, enrollment, "cancel")).status).toBe("CANCELLED");
    expect((await summaryRow(world, period.enrollmentPeriodId))?.["total"]).toEqual(money(500));
    expect(await dues(world)).toEqual([]);
  });

  it("creating an enrollment that starts active recognises its first period on the creation date", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    await seedAccountsFor(world);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    expect(enrollment.status).toBe("ACTIVE");
    const period = await periodAt(world, enrollment.enrollmentId, 0);
    const rows = await periodEventRows(world, period.enrollmentPeriodId);
    expect(rows.map((row) => row.type)).toEqual([ENROLLMENT_EVENT_TYPE.PERIOD_REVENUE_RECOGNIZED]);
    await postEnrollmentEvents(world);
    const revenue = await periodJournal(
      world,
      period.enrollmentPeriodId,
      POSTING_KEY.enrollment_period_revenue,
    );
    expect(revenue?.businessDate).toBe(today());
  });

  it("a business date at 02:00 Dhaka is the local date", async () => {
    harness.clock.setNow(new Date("2026-10-23T20:00:00Z"));
    const world = await worldFor(harness, RETAIL, GYM);
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    await seedAccountsFor(world);
    const plan = await publishPlan(world);
    const enrollment = await enroll(world, { ...plan, startsOn: today(), autoRenew: false });
    expect(today()).toBe("2026-10-24");
    const period = await periodAt(world, enrollment.enrollmentId, 0);
    await postEnrollmentEvents(world);
    const revenue = await periodJournal(
      world,
      period.enrollmentPeriodId,
      POSTING_KEY.enrollment_period_revenue,
    );
    expect(revenue?.businessDate).toBe("2026-10-24");
  });
});

async function closedRowOf(world: TwoOrganizations, enrollmentPeriodId: string) {
  const rows = await periodEventRows(world, enrollmentPeriodId);
  const closed = rows.find((row) => row.type === ENROLLMENT_EVENT_TYPE.PERIOD_REVENUE_CLOSED);
  if (closed === undefined) throw new Error("the close event was not written");
  return closed;
}

/** The stale-version bump joins the open transaction, so it waits for nothing and rolls back with it. */
function bumpSessionOptions() {
  const session = getActiveSession();
  return session === undefined ? undefined : { session };
}

async function failIfPaymentFinishedFirst(request: Promise<unknown>): Promise<never> {
  await request;
  throw new Error("payment finished before it reached the summary write");
}

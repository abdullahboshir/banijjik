import { newId } from "@banijjik/ids";
import { businessDateOf } from "../../booking/index.js";
import { money } from "../../../../test-support/catalog-world.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";
import type { EnrollmentPeriod } from "../domain/enrollment.entity.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENROLLMENT_SETTING } from "@banijjik/contracts/enrollment";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import { API_PASSWORD } from "../../../../test-support/auth-api-scenarios.js";
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

describe("staff check-in API", () => {
  it("enforces session limits and atomically consumes a bound one-time approval", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    const plan = await publishPlan(world, { sessionLimitPerPeriod: 1 });
    const contactId = await contact(world);
    const created = await enroll(world, { ...plan, contactId, startsOn: today(harness) });
    expect(created.status).toBe(201);
    const enrollment = created.body.data as Enrollment;
    const path = `/orgs/${world.organizationA}/check-ins`;
    const body = { contactId, enrollmentId: enrollment.enrollmentId, locationId: world.locationA1 };
    expect((await world.sam.call("post", path, body)).status).toBe(201);
    expect((await world.sam.call("post", path, body)).status).toBe(403);
    const roleId = await findSystemRoleId(harness.connections, world.organizationA, "MANAGER");
    const manager = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId },
    ]);
    expect(
      (
        await manager.actor.call("put", `/orgs/${world.organizationA}/me/approval-pin`, {
          currentPassword: API_PASSWORD,
          pin: "4321",
        })
      ).status,
    ).toBe(204);
    const approved = await world.sam.call("post", `/orgs/${world.organizationA}/approvals`, {
      action: "SESSION_LIMIT_OVERRIDE",
      subjectKey: `enrollment:${enrollment.enrollmentId}`,
      locationId: world.locationA1,
      approverMemberId: manager.memberId,
      pin: "4321",
    });
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    const approvalToken = (approved.body.data as { approvalToken: string }).approvalToken;
    expect((await world.sam.call("post", path, { ...body, approvalToken })).status).toBe(201);
    expect((await world.sam.call("post", path, { ...body, approvalToken })).status).toBe(403);
    expect((await getEnrollment(world, enrollment.enrollmentId)).periods[0]?.sessionsUsed).toBe(2);
    const list = await world.alice.call("get", `${path}?checkedInOn=${today(harness)}`);
    expect(list.body.data).toHaveLength(2);
    expect(JSON.stringify(list.body)).not.toContain('"_id"');
  });

  it("blocks overdue check-in by default and permits it only when the setting allows it", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    const plan = await publishPlan(world);
    const contactId = await contact(world);
    const created = await enroll(world, { ...plan, contactId, startsOn: today(harness) });
    const enrollment = created.body.data as Enrollment;
    await harness.connections.tenantShared
      .collection("enrollments")
      .updateOne(
        { organizationId: world.organizationA, enrollmentId: enrollment.enrollmentId },
        { $set: { status: "OVERDUE" } },
      );
    const path = `/orgs/${world.organizationA}/check-ins`;
    const body = { contactId, enrollmentId: enrollment.enrollmentId, locationId: world.locationA1 };
    expect((await world.alice.call("post", path, body)).status).toBe(400);
    await setting(world, ENROLLMENT_SETTING.BLOCK_OVERDUE, false);
    expect((await world.alice.call("post", path, body)).status).toBe(201);
  });

  it("allows a same-contact confirmed booking today and refuses another contact", async () => {
    const world = await worldFor(harness, RETAIL, GYM);
    const contactId = await contact(world);
    const otherContact = await contact(world, { name: "Other member" });
    const offering = await world.alice.call("post", `/orgs/${world.organizationA}/offerings`, {
      kind: "SERVICE",
      name: "Training",
      kindDetails: { durationMinutes: 30, requiresResource: false, resourceTypeKeys: [] },
      variants: [{ name: "Session", price: { amount: 1000, currency: "BDT" }, unitKey: "SESSION" }],
    });
    expect(offering.status).toBe(201);
    const record = offering.body.data as {
      offeringId: string;
      version: number;
      variants: { variantId: string }[];
    };
    expect(
      (
        await world.alice.call(
          "post",
          `/orgs/${world.organizationA}/offerings/${record.offeringId}/publish`,
          { version: record.version },
        )
      ).status,
    ).toBe(200);
    const trainer = await world.alice.call("post", `/orgs/${world.organizationA}/resources`, {
      locationId: world.locationA1,
      resourceTypeKey: "TRAINER",
      name: "Trainer",
      capacity: 1,
      weeklySchedule: Array.from({ length: 7 }, (_, index) => ({
        weekday: index + 1,
        opensAt: "00:00",
        closesAt: "23:59",
      })),
      offeringIds: [record.offeringId],
    });
    expect(trainer.status, JSON.stringify(trainer.body)).toBe(201);
    const booking = await world.alice.call("post", `/orgs/${world.organizationA}/bookings`, {
      offeringId: record.offeringId,
      variantId: record.variants[0]?.variantId,
      contactId,
      locationId: world.locationA1,
      startsAt: new Date(harness.clock.now().getTime() + 3600000).toISOString(),
    });
    expect(booking.status, JSON.stringify(booking.body)).toBe(201);
    const bookingId = (booking.body.data as { bookingId: string }).bookingId;
    await harness.connections.tenantShared
      .collection("bookings")
      .updateOne(
        { organizationId: world.organizationA, bookingId },
        { $set: { status: "CONFIRMED", startsAt: harness.clock.now() } },
      );
    const path = `/orgs/${world.organizationA}/check-ins`;
    expect(
      (
        await world.alice.call("post", path, {
          contactId: otherContact,
          bookingId,
          locationId: world.locationA1,
        })
      ).status,
    ).toBe(400);
    const checked = await world.alice.call("post", path, {
      contactId,
      bookingId,
      locationId: world.locationA1,
    });
    expect(checked.status, JSON.stringify(checked.body)).toBe(201);
    expect(checked.body.data.bookingId).toBe(bookingId);
    const discovered = await world.alice.call("post", path, {
      contactId,
      locationId: world.locationA1,
    });
    expect(discovered.status, JSON.stringify(discovered.body)).toBe(201);
    expect(discovered.body.data.bookingId).toBe(bookingId);
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

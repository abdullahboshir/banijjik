import { newId } from "@banijjik/ids";
import { businessDateOf } from "../../booking/index.js";
import { money } from "../../../../test-support/catalog-world.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENROLLMENT_SETTING } from "@banijjik/contracts/enrollment";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
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
const HOSTEL = { industryTemplateKey: "HOSTEL" };

describe("enrollment open-ended beds", () => {
  it("serializes two parallel enrollments on one bed to one 201 and one 409", async () => {
    const world = await worldFor(harness, RETAIL, HOSTEL);
    const resource = await world.alice.call("post", `/orgs/${world.organizationA}/resources`, {
      locationId: world.locationA1,
      resourceTypeKey: "BED",
      name: "Bed 1",
      capacity: 1,
      weeklySchedule: [],
      offeringIds: [],
    });
    expect(resource.status, JSON.stringify(resource.body)).toBe(201);
    const resourceId = (resource.body.data as { resourceId: string }).resourceId;
    const plan = await publishPlan(world);
    const contactId = await contact(world);
    const payload = { ...plan, contactId, resourceIds: [resourceId], startsOn: today(harness) };
    const attempts = await Promise.all([enroll(world, payload), enroll(world, payload)]);
    expect(attempts.map((response) => response.status).sort()).toEqual([201, 409]);
    const rows = await harness.connections.tenantShared
      .collection("resource_exclusive_holds")
      .find({ organizationId: world.organizationA, resourceId })
      .toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.["endsOn"]).toBeNull();
  });

  it("keeps a bed through renewal and releases it without deleting history at cancellation", async () => {
    const world = await worldFor(harness, RETAIL, HOSTEL);
    await setting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    const resource = await world.alice.call("post", `/orgs/${world.organizationA}/resources`, {
      locationId: world.locationA1,
      resourceTypeKey: "BED",
      name: "Bed 2",
      capacity: 1,
      weeklySchedule: [],
      offeringIds: [],
    });
    expect(resource.status).toBe(201);
    const resourceId = (resource.body.data as { resourceId: string }).resourceId;
    const plan = await publishPlan(world);
    const contactId = await contact(world);
    const payload = {
      ...plan,
      contactId,
      resourceIds: [resourceId],
      startsOn: addDays(today(harness), -35),
      autoRenew: false,
    };
    const created = await enroll(world, payload);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    let enrollment = created.body.data as Enrollment;
    enrollment = await action(world, enrollment, "renew");
    let hold = await harness.connections.tenantShared
      .collection("resource_exclusive_holds")
      .findOne({ organizationId: world.organizationA, enrollmentId: enrollment.enrollmentId });
    expect(hold?.["endsOn"]).toBeNull();
    enrollment = await action(world, enrollment, "freeze");
    expect((await enroll(world, { ...payload, startsOn: today(harness) })).status).toBe(409);
    enrollment = await action(world, enrollment, "unfreeze");
    enrollment = await action(world, enrollment, "cancel");
    hold = await harness.connections.tenantShared
      .collection("resource_exclusive_holds")
      .findOne({ organizationId: world.organizationA, enrollmentId: enrollment.enrollmentId });
    expect(hold?.["endsOn"]).toBe(today(harness));
    const earlier = await enroll(world, { ...payload, startsOn: addDays(today(harness), -1) });
    expect(earlier.status, JSON.stringify(earlier.body)).toBe(409);
    const released = await enroll(world, { ...payload, startsOn: today(harness) });
    expect(released.status, JSON.stringify(released.body)).toBe(201);
    expect(
      await harness.connections.tenantShared
        .collection("resource_exclusive_holds")
        .countDocuments({ organizationId: world.organizationA, resourceId }),
    ).toBe(2);
  });
});

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

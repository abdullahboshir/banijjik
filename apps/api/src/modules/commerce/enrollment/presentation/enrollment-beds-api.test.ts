import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENROLLMENT_SETTING } from "@banijjik/contracts/enrollment";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import type { Enrollment } from "../domain/enrollment.entity.js";
import { addDays } from "../domain/period-dates.js";
import {
  publishPlan,
  contact,
  enroll,
  today,
  setting,
  action,
} from "../test-support/enrollment-api-world.js";

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

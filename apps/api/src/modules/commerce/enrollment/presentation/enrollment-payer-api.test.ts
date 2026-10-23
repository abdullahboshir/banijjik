import { businessDateOf } from "../../booking/index.js";
import { money } from "../../../../test-support/catalog-world.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "@banijjik/ids";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";

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
const COACHING = { industryTemplateKey: "COACHING" };

describe("enrollment payer API", () => {
  it("uses the configured guardian link and lets an explicit active payer override it", async () => {
    const world = await worldFor(harness, RETAIL, COACHING);
    const guardianId = await contact(world, { name: "Guardian" });
    const otherPayer = await contact(world, { name: "Other payer" });
    const student = await contact(world, {
      contactRoles: ["CUSTOMER"],
      customFields: { class_level: "CLASS_10", guardian: guardianId },
    });
    const plan = await publishPlan(world);
    const first = await enroll(world, { ...plan, contactId: student, startsOn: today(harness) });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body.data.billToContactId).toBe(guardianId);
    const explicit = await enroll(world, {
      ...plan,
      contactId: student,
      billToContactId: otherPayer,
      startsOn: today(harness),
    });
    expect(explicit.status, JSON.stringify(explicit.body)).toBe(201);
    expect(explicit.body.data.billToContactId).toBe(otherPayer);
  });

  it("rejects unknown and archived explicit payers with 400 and falls back when no link exists", async () => {
    const world = await worldFor(harness, RETAIL, COACHING);
    const person = await contact(world);
    const archived = await contact(world, { name: "Archived payer" });
    await harness.connections.tenantShared
      .collection("contacts")
      .updateOne(
        { organizationId: world.organizationA, contactId: archived },
        { $set: { status: "ARCHIVED" } },
      );
    const plan = await publishPlan(world);
    for (const billToContactId of [newId(), archived]) {
      const response = await enroll(world, {
        ...plan,
        contactId: person,
        billToContactId,
        startsOn: today(harness),
      });
      expect(response.status, JSON.stringify(response.body)).toBe(400);
    }
    const fallback = await enroll(world, { ...plan, contactId: person, startsOn: today(harness) });
    expect(fallback.status).toBe(201);
    expect(fallback.body.data.billToContactId).toBe(person);
  });

  it("never returns the guardian or explicit payer of another organization", async () => {
    const world = await worldFor(harness, RETAIL, COACHING);
    const outsider = await world.bob.call("post", `/orgs/${world.organizationB}/contacts`, {
      contactType: "PERSON",
      name: "Outside guardian",
      contactRoles: ["CUSTOMER"],
    });
    expect(outsider.status).toBe(201);
    const outsideId = (outsider.body.data as { contactId: string }).contactId;
    const student = await contact(world);
    // Seed an invalid legacy link; the read port must still enforce the tenant boundary.
    await harness.connections.tenantShared
      .collection("contacts")
      .updateOne(
        { organizationId: world.organizationA, contactId: student },
        { $set: { "customFields.guardian": outsideId } },
      );
    const plan = await publishPlan(world);
    const fallback = await enroll(world, { ...plan, contactId: student, startsOn: today(harness) });
    expect(fallback.status, JSON.stringify(fallback.body)).toBe(201);
    expect(fallback.body.data.billToContactId).toBe(student);
    const explicit = await enroll(world, {
      ...plan,
      contactId: student,
      billToContactId: outsideId,
      startsOn: today(harness),
    });
    expect(explicit.status).toBe(400);
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

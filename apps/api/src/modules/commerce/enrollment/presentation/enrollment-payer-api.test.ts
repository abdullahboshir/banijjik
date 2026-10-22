import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "@banijjik/ids";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { publishPlan, contact, enroll, today } from "../test-support/enrollment-api-world.js";

registerIamApiModels();
let harness: IamApiHarness;
beforeAll(async () => {
  harness = await startCatalogApi();
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

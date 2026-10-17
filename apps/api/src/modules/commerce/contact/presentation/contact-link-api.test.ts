import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi();
});

afterAll(async () => {
  await harness.dispose();
});

// The coaching template is still a draft, so signup cannot pick it. The organizations start on
// retail and are moved onto coaching the way 2.1b's change-template does: key and config version.
// The coaching template makes `guardian` a required contact-link field (ADR-073).
async function aCoachingWorld(): Promise<TwoOrganizations> {
  const world = await createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
  await harness.connections.platform
    .collection("organizations")
    .updateMany(
      { organizationId: { $in: [world.organizationA, world.organizationB] } },
      { $set: { industryTemplateKey: "COACHING" }, $inc: { configVersion: 1 } },
    );
  return world;
}

function contactsPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/contacts${suffix}`;
}

function student(name: string, guardian: unknown, extra: object = {}) {
  return {
    contactType: "PERSON",
    name,
    contactRoles: ["CUSTOMER"],
    customFields: { class_level: "CLASS_5", guardian },
    ...extra,
  };
}

const GUARDIAN = { create: { name: "Abdul Karim", phone: "01712349001" } };

async function countContactsByName(world: TwoOrganizations, name: string): Promise<number> {
  return harness.connections.tenantShared
    .collection("contacts")
    .countDocuments({ organizationId: world.organizationA, name });
}

describe("the contact-link field of a coaching student", () => {
  it("creates the guardian by phone, stores its id and relates it GUARDIAN_OF the student", async () => {
    const world = await aCoachingWorld();

    const created = await world.alice.call(
      "post",
      contactsPath(world.organizationA),
      student("Student One", GUARDIAN),
    );

    expect(created.status).toBe(201);
    const guardianId = created.body.data.customFields.guardian as string;
    const guardian = await world.alice.call(
      "get",
      contactsPath(world.organizationA, `/${guardianId}`),
    );
    expect(guardian.body.data).toMatchObject({ name: "Abdul Karim", phoneE164: "+8801712349001" });
    expect(guardian.body.data.relations).toEqual([
      {
        relatedContactId: created.body.data.contactId,
        relationKey: "GUARDIAN_OF",
        relatedContactName: "Student One",
      },
    ]);
  });

  it("links the same guardian for a second student with the same phone", async () => {
    const world = await aCoachingWorld();
    const first = await world.alice.call(
      "post",
      contactsPath(world.organizationA),
      student("Sibling One", GUARDIAN),
    );

    const second = await world.alice.call(
      "post",
      contactsPath(world.organizationA),
      student("Sibling Two", { create: { name: "Typed Differently", phone: "+8801712349001" } }),
    );

    expect(second.body.data.customFields.guardian).toBe(first.body.data.customFields.guardian);
    expect(await countContactsByName(world, "Abdul Karim")).toBe(1);
    const guardian = await world.alice.call(
      "get",
      contactsPath(world.organizationA, `/${first.body.data.customFields.guardian}`),
    );
    expect(guardian.body.data.relations).toHaveLength(2);
  });

  it("refuses a guardian id from another organization with 400 at customFields.guardian", async () => {
    const world = await aCoachingWorld();
    const foreign = await world.bob.call(
      "post",
      contactsPath(world.organizationB),
      student("Bob Student", { create: { name: "Bob Guardian", phone: "01712349002" } }),
    );
    const foreignGuardian = foreign.body.data.customFields.guardian as string;

    const response = await world.alice.call(
      "post",
      contactsPath(world.organizationA),
      student("Alice Student", foreignGuardian),
    );

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields[0].path).toBe("customFields.guardian");
  });

  it("leaves no orphan guardian when the request fails after the guardian was made", async () => {
    const world = await aCoachingWorld();
    const request = student("Doomed Student", {
      create: { name: "Orphan Guardian", phone: "01712349003" },
    });

    const response = await world.alice.call("post", contactsPath(world.organizationA), {
      ...request,
      customFields: { ...request.customFields, class_level: "NOT_A_CLASS" },
    });

    expect(response.status).toBe(400);
    expect(await countContactsByName(world, "Orphan Guardian")).toBe(0);
  });
});

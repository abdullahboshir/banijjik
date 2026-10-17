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

  it("links one guardian when two students with the same new guardian phone are created at once", async () => {
    const world = await aCoachingWorld();
    const sameGuardian = { create: { name: "Shared Guardian", phone: "01712349004" } };

    const results = await Promise.all([
      world.alice.call("post", contactsPath(world.organizationA), student("Twin A", sameGuardian)),
      world.alice.call("post", contactsPath(world.organizationA), student("Twin B", sameGuardian)),
    ]);

    expect(results.map((result) => result.status)).toEqual([201, 201]);
    expect(results[0]?.body.data.customFields.guardian).toBe(
      results[1]?.body.data.customFields.guardian,
    );
    expect(await countContactsByName(world, "Shared Guardian")).toBe(1);
  });

  it("refuses a student whose own phone is the guardian's phone, at customFields.guardian", async () => {
    const world = await aCoachingWorld();

    const response = await world.alice.call(
      "post",
      contactsPath(world.organizationA),
      student(
        "Self Linked",
        { create: { name: "Same Person", phone: "01712349005" } },
        {
          phoneE164: "+8801712349005",
        },
      ),
    );

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields[0].path).toBe("customFields.guardian");
    expect(await countContactsByName(world, "Same Person")).toBe(0);
  });
});

describe("contact roles on a coaching organization", () => {
  async function createRelated(world: TwoOrganizations, name: string, role = "RELATED") {
    return world.alice.call("post", contactsPath(world.organizationA), {
      contactType: "PERSON",
      name,
      contactRoles: [role],
    });
  }

  it("creates a related person and a supplier by hand without class level or guardian", async () => {
    const world = await aCoachingWorld();

    const related = await createRelated(world, "Aunt Rina");
    const supplier = await createRelated(world, "Book Seller", "SUPPLIER");

    expect(related.status).toBe(201);
    expect(supplier.status).toBe(201);
  });

  it("still needs class level and guardian for a customer", async () => {
    const world = await aCoachingWorld();

    const response = await world.alice.call("post", contactsPath(world.organizationA), {
      contactType: "PERSON",
      name: "No Fields Student",
      contactRoles: ["CUSTOMER"],
    });

    expect(response.status).toBe(400);
  });

  it("creates the linked guardian as RELATED and lists it with ?role=RELATED", async () => {
    const world = await aCoachingWorld();
    await world.alice.call(
      "post",
      contactsPath(world.organizationA),
      student("Student Roles", { create: { name: "Guardian Roles", phone: "01712349010" } }),
    );

    const related = await world.alice.call(
      "get",
      contactsPath(world.organizationA, "?role=RELATED"),
    );
    const customers = await world.alice.call(
      "get",
      contactsPath(world.organizationA, "?role=CUSTOMER"),
    );

    expect(related.body.data.map((row: { name: string }) => row.name)).toEqual(["Guardian Roles"]);
    expect(related.body.data[0].contactRoles).toEqual(["RELATED"]);
    expect(customers.body.data.map((row: { name: string }) => row.name)).toEqual(["Student Roles"]);
  });

  it("refuses a value for a field that does not apply to the contact's roles", async () => {
    const world = await aCoachingWorld();

    const response = await world.alice.call("post", contactsPath(world.organizationA), {
      contactType: "PERSON",
      name: "Related With Class",
      contactRoles: ["RELATED"],
      customFields: { class_level: "CLASS_5" },
    });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields[0]).toEqual({
      path: "customFields.class_level",
      messageKey: "validation.not_applicable",
    });
  });

  it("does not force the fields when a role is added, and keeps and hides values that stop applying", async () => {
    const world = await aCoachingWorld();
    const related = await createRelated(world, "Becomes Student");
    const relatedPath = contactsPath(world.organizationA, `/${related.body.data.contactId}`);

    const added = await world.alice.call("patch", relatedPath, {
      contactRoles: ["RELATED", "CUSTOMER"],
      version: 1,
    });
    const filled = await world.alice.call("patch", relatedPath, {
      customFields: { class_level: "SSC" },
      version: 2,
    });
    const onlyRelated = await world.alice.call("patch", relatedPath, {
      contactRoles: ["RELATED"],
      version: 3,
    });
    const customerAgain = await world.alice.call("patch", relatedPath, {
      contactRoles: ["CUSTOMER"],
      version: 4,
    });

    expect(added.status).toBe(200);
    expect(filled.body.data.customFields).toEqual({ class_level: "SSC" });
    expect(onlyRelated.body.data.customFields).toEqual({});
    expect(customerAgain.body.data.customFields).toEqual({ class_level: "SSC" });
  });
});

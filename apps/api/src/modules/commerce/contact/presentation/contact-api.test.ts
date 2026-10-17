import { SYSTEM_ROLE_KEY, type SystemRoleKey } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  countAuditRows,
  countOutboxRows,
} from "../../../../test-support/organization-tenant-world.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
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

function aWorld(): Promise<TwoOrganizations> {
  return createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
}

function contactsPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/contacts${suffix}`;
}

const CUSTOMER_ROLES = ["CUSTOMER"];

async function createContact(
  world: TwoOrganizations,
  body: object,
  actor = world.alice,
  organizationId = world.organizationA,
) {
  return actor.call("post", contactsPath(organizationId), {
    contactType: "PERSON",
    contactRoles: CUSTOMER_ROLES,
    ...body,
  });
}

async function defineContactField(world: TwoOrganizations, spec: object): Promise<void> {
  const response = await world.alice.call("post", `/orgs/${world.organizationA}/custom-fields`, {
    entityType: "contact",
    label: { bn: "x", en: "x" },
    isRequired: false,
    visibility: { admin: true, storefront: false, bot: false },
    botAsk: false,
    isSearchable: false,
    isSensitive: false,
    sortOrder: 10,
    ...spec,
  });
  expect(response.status).toBe(201);
}

describe("POST /contacts", () => {
  it("creates a contact with one audit entry and one event", async () => {
    const world = await aWorld();
    const auditBefore = await countAuditRows(harness.connections, {
      action: "contact.contact.created",
    });
    const eventsBefore = await countOutboxRows(harness.connections, {
      type: "contact.contact.created",
    });

    const response = await createContact(world, { name: "Rahim", phoneE164: "01712345001" });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      name: "Rahim",
      phoneE164: "+8801712345001",
      status: "ACTIVE",
      version: 1,
      relations: [],
    });
    expect(await countAuditRows(harness.connections, { action: "contact.contact.created" })).toBe(
      auditBefore + 1,
    );
    expect(await countOutboxRows(harness.connections, { type: "contact.contact.created" })).toBe(
      eventsBefore + 1,
    );
  });

  it("refuses a contact with neither a name nor a phone", async () => {
    const world = await aWorld();

    const response = await createContact(world, {});

    expect(response.status).toBe(400);
  });

  it("refuses a bad phone and an unknown role", async () => {
    const world = await aWorld();

    expect((await createContact(world, { phoneE164: "123" })).status).toBe(400);
    expect((await createContact(world, { name: "A", contactRoles: ["WIZARD"] })).status).toBe(400);
  });

  it("answers 409 with the existing contact when the phone is taken, in any typed form", async () => {
    const world = await aWorld();
    const first = await createContact(world, { name: "Karim", phoneE164: "01712345002" });

    const second = await createContact(world, { name: "Other", phoneE164: "+8801712345002" });

    expect(second.status).toBe(409);
    expect(second.body.error.messageKey).toBe("errors.contact_duplicate");
    expect(second.body.error.details.contactId).toBe(first.body.data.contactId);
  });

  it("catches an email only when the organization dedupes on phone or email", async () => {
    const world = await aWorld();
    await createContact(world, { name: "One", email: "same@example.com" });
    expect((await createContact(world, { name: "Two", email: "same@example.com" })).status).toBe(
      201,
    );
    const setting = await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [{ settingKey: "contact.dedupeOn", value: "PHONE_OR_EMAIL" }],
    });
    expect(setting.status).toBe(200);

    const third = await createContact(world, { name: "Three", email: "same@example.com" });

    expect(third.status).toBe(409);
  });

  it("lets two concurrent creates with one phone end as one 201 and one 409", async () => {
    const world = await aWorld();

    const results = await Promise.all([
      createContact(world, { name: "Race A", phoneE164: "01712345003" }),
      createContact(world, { name: "Race B", phoneE164: "01712345003" }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  });
});

describe("GET /contacts", () => {
  it("finds by a Bangla or Latin name prefix, a national phone and a custom field value", async () => {
    const world = await aWorld();
    await defineContactField(world, {
      fieldKey: "shop_note",
      fieldType: "TEXT",
      isSearchable: true,
    });
    await createContact(world, { name: "রহিম উদ্দিন", phoneE164: "01712345004" });
    await createContact(world, {
      name: "Sultana",
      phoneE164: "01812345005",
      customFields: { shop_note: "Wholesale" },
    });
    const find = async (query: string) =>
      (
        await world.alice.call(
          "get",
          contactsPath(world.organizationA, `?q=${encodeURIComponent(query)}`),
        )
      ).body.data.map((row: { name: string }) => row.name);

    expect(await find("রহিম")).toEqual(["রহিম উদ্দিন"]);
    expect(await find("sult")).toEqual(["Sultana"]);
    expect(await find("017123450")).toEqual(["রহিম উদ্দিন"]);
    expect(await find("+88018123")).toEqual(["Sultana"]);
    expect(await find("whole")).toEqual(["Sultana"]);
  });

  it("returns lean rows without custom fields and pages with a limit of at most 100", async () => {
    const world = await aWorld();
    await createContact(world, { name: "Lean", phoneE164: "01712345006" });

    const response = await world.alice.call("get", contactsPath(world.organizationA, "?limit=1"));

    expect(response.status).toBe(200);
    expect(Object.keys(response.body.data[0]).sort()).toEqual([
      "contactId",
      "contactRoles",
      "name",
      "phoneE164",
      "status",
      "tagKeys",
      "updatedAt",
    ]);
    expect(response.body.meta).toMatchObject({ page: 1, limit: 1 });
    const tooMany = await world.alice.call("get", contactsPath(world.organizationA, "?limit=101"));
    expect(tooMany.status).toBe(400);
  });

  it("uses an index for the list and the name search", async () => {
    const world = await aWorld();
    await createContact(world, { name: "Indexed", phoneE164: "01712345007" });
    const collection = harness.connections.tenantShared.collection("contacts");

    const plan = await collection
      .find({ organizationId: world.organizationA, status: "ACTIVE" })
      .sort({ updatedAt: -1 })
      .explain("queryPlanner");
    const nameSearch = await collection
      .find({ organizationId: world.organizationA, nameSearch: { $regex: "^indexed" } })
      .explain("queryPlanner");

    expect(JSON.stringify(plan)).toContain("IXSCAN");
    expect(JSON.stringify(nameSearch)).toContain("IXSCAN");
  });

  it("does not show another organization's contacts, and answers 404 by id", async () => {
    const world = await aWorld();
    const foreign = await createContact(
      world,
      { name: "Bob's", phoneE164: "01712345008" },
      world.bob,
      world.organizationB,
    );

    const list = await world.alice.call("get", contactsPath(world.organizationA));
    const byId = await world.alice.call(
      "get",
      contactsPath(world.organizationA, `/${foreign.body.data.contactId}`),
    );

    expect(list.body.data.map((row: { name: string }) => row.name)).not.toContain("Bob's");
    expect(byId.status).toBe(404);
  });
});

describe("PATCH, archive and anonymize", () => {
  it("updates with the version, refuses a stale one, and records the change", async () => {
    const world = await aWorld();
    const created = await createContact(world, { name: "Edit Me", phoneE164: "01712345009" });
    const { contactId } = created.body.data;

    const updated = await world.alice.call(
      "patch",
      contactsPath(world.organizationA, `/${contactId}`),
      {
        name: "Edited",
        tagKeys: ["vip"],
        version: 1,
      },
    );
    const stale = await world.alice.call(
      "patch",
      contactsPath(world.organizationA, `/${contactId}`),
      {
        name: "Again",
        version: 1,
      },
    );

    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ name: "Edited", version: 2, tagKeys: ["vip"] });
    expect(stale.status).toBe(409);
    expect(
      await countAuditRows(harness.connections, {
        entityId: contactId,
        action: "contact.contact.updated",
      }),
    ).toBe(1);
  });

  it("refuses to give a contact the phone of another active contact", async () => {
    const world = await aWorld();
    const first = await createContact(world, { name: "First", phoneE164: "01712345010" });
    const second = await createContact(world, { name: "Second", phoneE164: "01712345011" });

    const response = await world.alice.call(
      "patch",
      contactsPath(world.organizationA, `/${second.body.data.contactId}`),
      { phoneE164: "01712345010", version: 1 },
    );

    expect(response.status).toBe(409);
    expect(response.body.error.details.contactId).toBe(first.body.data.contactId);
  });

  it("frees the phone of an archived contact for a new contact", async () => {
    const world = await aWorld();
    const old = await createContact(world, { name: "Old", phoneE164: "01712345012" });

    const archived = await world.alice.call(
      "post",
      contactsPath(world.organizationA, `/${old.body.data.contactId}/archive`),
      { version: 1 },
    );
    const reused = await createContact(world, { name: "New", phoneE164: "01712345012" });

    expect(archived.status).toBe(200);
    expect(archived.body.data.status).toBe("ARCHIVED");
    expect(reused.status).toBe(201);
    expect(
      await countAuditRows(harness.connections, {
        entityId: old.body.data.contactId,
        action: "contact.contact.archived",
      }),
    ).toBe(1);
  });

  it("anonymizes: clears personal data, keeps the id, and the audit entry holds no old value", async () => {
    const world = await aWorld();
    const created = await createContact(world, {
      name: "Secret Name",
      phoneE164: "01712345013",
      email: "secret@example.com",
      addresses: [{ label: "Home", line1: "12 Road", isDefault: true }],
    });
    const { contactId } = created.body.data;

    const response = await world.alice.call(
      "post",
      contactsPath(world.organizationA, `/${contactId}/anonymize`),
      { version: 1, reason: "Erasure request" },
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      contactId,
      name: null,
      phoneE164: null,
      email: null,
      addresses: [],
      customFields: {},
      status: "ARCHIVED",
    });
    const rows = await harness.connections.tenantShared
      .collection("audit_logs")
      .find({ entityId: contactId })
      .toArray();
    expect(JSON.stringify(rows)).not.toContain("Secret Name");
    expect(JSON.stringify(rows)).not.toContain("01712345013");
    expect(JSON.stringify(rows)).not.toContain("secret@example.com");
    expect(
      await countOutboxRows(harness.connections, { type: "contact.contact.anonymized" }),
    ).toBeGreaterThan(0);
  });
});

describe("sensitive custom fields and permissions", () => {
  it("redacts a sensitive value without readSensitive and refuses to write it with 403", async () => {
    const world = await aWorld();
    await defineContactField(world, { fieldKey: "nid", fieldType: "TEXT", isSensitive: true });
    const managerRole = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.STAFF,
    );
    const staff = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: "ALL", roleId: managerRole },
    ]);
    const created = await createContact(world, { name: "Has NID", customFields: { nid: "1234" } });
    const path = contactsPath(world.organizationA, `/${created.body.data.contactId}`);

    const seenByOwner = await world.alice.call("get", path);
    const seenByStaff = await staff.actor.call("get", path);
    const staffWrite = await staff.actor.call("patch", path, {
      customFields: { nid: "9" },
      version: 1,
    });

    expect(seenByOwner.body.data.customFields).toEqual({ nid: "1234" });
    expect(seenByStaff.body.data.customFields).toEqual({});
    expect(staffWrite.status).toBe(403);
  });

  it("lets staff create and update but not archive or anonymize, and a rider read only", async () => {
    const world = await aWorld();
    const created = await createContact(world, { name: "Perm", phoneE164: "01712345014" });
    const path = contactsPath(world.organizationA, `/${created.body.data.contactId}`);
    const asRole = async (roleKey: SystemRoleKey) => {
      const roleId = await findSystemRoleId(harness.connections, world.organizationA, roleKey);
      return (
        await addMemberWithAssignments(harness.app, world.organizationA, [
          { locationId: "ALL", roleId },
        ])
      ).actor;
    };
    const staff = await asRole(SYSTEM_ROLE_KEY.STAFF);
    const rider = await asRole(SYSTEM_ROLE_KEY.RIDER);

    expect((await staff.call("patch", path, { name: "Perm 2", version: 1 })).status).toBe(200);
    expect((await staff.call("post", `${path}/archive`, { version: 2 })).status).toBe(403);
    expect(
      (await staff.call("post", `${path}/anonymize`, { version: 2, reason: "x" })).status,
    ).toBe(403);
    expect((await rider.call("get", path)).status).toBe(200);
    expect((await createContact(world, { name: "Nope" }, rider)).status).toBe(403);
  });

  it("refuses a home location outside the caller's reach with 403", async () => {
    const world = await aWorld();

    const response = await createContact(
      world,
      { name: "Far Away", homeLocationId: world.locationA2 },
      world.sam,
    );
    const allowed = await createContact(
      world,
      { name: "Near", homeLocationId: world.locationA1 },
      world.sam,
    );

    expect(response.status).toBe(403);
    expect(allowed.status).toBe(201);
  });
});

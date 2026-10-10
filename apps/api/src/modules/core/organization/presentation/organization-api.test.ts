import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asCookies, callApi } from "../../../../test-support/auth-api-client.js";
import {
  registerViaApi,
  type RegisteredPerson,
} from "../../../../test-support/auth-api-scenarios.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import {
  addManagerMember,
  closeOrganization,
} from "../../../../test-support/organization-api-scenarios.js";

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi();
});

afterAll(async () => {
  await harness.dispose();
});

let issuedSlugs = 0;

function freshSlug(): string {
  issuedSlugs += 1;
  return `shop-${issuedSlugs}`;
}

function createOrganization(person: RegisteredPerson, body: object) {
  return callApi(harness.app, {
    method: "post",
    path: "/api/v1/me/orgs",
    cookies: asCookies(person.session),
    body,
  });
}

function aValidBody(overrides: object = {}): object {
  return {
    name: "Rahim Store",
    slug: freshSlug(),
    industryTemplateKey: "RETAIL",
    ...overrides,
  };
}

function listOrganizations(person: RegisteredPerson) {
  return callApi(harness.app, {
    method: "get",
    path: "/api/v1/me/orgs",
    cookies: asCookies(person.session),
  });
}

function documentsOf(collectionName: string, organizationId: string) {
  return harness.connections.platform.collection(collectionName).find({ organizationId }).toArray();
}

describe("POST /me/orgs", () => {
  it("creates the organization with its default location, six roles and owner member in one go", async () => {
    const person = await registerViaApi(harness.app);
    const slug = freshSlug();

    const response = await createOrganization(person, aValidBody({ slug, district: "Dhaka" }));

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({
      organizationId: expect.any(String),
      slug,
      name: "Rahim Store",
      status: "ACTIVE",
      roleKeys: ["OWNER"],
    });
    const organizationId: string = response.body.data.organizationId;
    const [organization] = await documentsOf("organizations", organizationId);
    const locations = await documentsOf("locations", organizationId);
    const roles = await documentsOf("roles", organizationId);
    const members = await documentsOf("members", organizationId);
    expect(organization).toMatchObject({
      slug,
      ownerUserId: person.me.userId,
      industryTemplateKey: "RETAIL",
      deployment: "SHARED",
      countryCode: "BD",
      currencyCode: "BDT",
      timezone: "Asia/Dhaka",
      defaultLocale: "bn",
      configVersion: 1,
      version: 1,
    });
    expect(locations).toHaveLength(1);
    expect(locations[0]).toMatchObject({
      isDefault: true,
      locationType: "STORE",
      status: "ACTIVE",
      name: "Rahim Store",
      address: { district: "Dhaka" },
    });
    expect(roles.map((role) => role["roleKey"]).sort()).toEqual(
      Object.values(SYSTEM_ROLE_KEY).sort(),
    );
    const ownerRole = roles.find((role) => role["roleKey"] === "OWNER");
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({
      userId: person.me.userId,
      status: "ACTIVE",
      employeeNumber: "1",
      assignments: [{ locationId: "ALL", roleId: ownerRole?.["roleId"] }],
    });
  });

  it("never returns a Mongo id in the response", async () => {
    const person = await registerViaApi(harness.app);

    const response = await createOrganization(person, aValidBody());

    expect(JSON.stringify(response.body)).not.toContain("_id");
  });

  it.each([
    ["a slug with a double hyphen", { slug: "rahim--store" }, "slug"],
    ["a reserved slug", { slug: "admin" }, "slug"],
    ["a slug in Bangla", { slug: "রহিম-স্টোর" }, "slug"],
    [
      "an industry template key that does not exist",
      { industryTemplateKey: "BAKERY" },
      "industryTemplateKey",
    ],
    ["a name that is too short", { name: "a" }, "name"],
    ["a field the client may not set", { currencyCode: "BDT" }, ""],
  ])("rejects %s with 400 and the field path", async (_description, override, path) => {
    const person = await registerViaApi(harness.app);

    const response = await createOrganization(person, aValidBody(override));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.fields[0].path).toBe(path);
  });

  it("answers a slug that is already taken with 409 DUPLICATE on the slug field", async () => {
    const first = await registerViaApi(harness.app);
    const second = await registerViaApi(harness.app);
    const slug = freshSlug();
    await createOrganization(first, aValidBody({ slug }));

    const response = await createOrganization(second, aValidBody({ slug: slug.toUpperCase() }));

    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({ code: "DUPLICATE", details: { field: "slug" } });
  });

  it("makes exactly one organization when two requests race for the same slug", async () => {
    const first = await registerViaApi(harness.app);
    const second = await registerViaApi(harness.app);
    const slug = freshSlug();

    const responses = await Promise.all([
      createOrganization(first, aValidBody({ slug })),
      createOrganization(second, aValidBody({ slug })),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const stored = await harness.connections.platform
      .collection("organizations")
      .countDocuments({ slug });
    expect(stored).toBe(1);
  });

  it("answers 401 without a session", async () => {
    const response = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/me/orgs",
      body: aValidBody(),
    });

    expect(response.status).toBe(401);
  });

  it("answers the sixth creation within a day with 429 and Retry-After", async () => {
    const person = await registerViaApi(harness.app);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const created = await createOrganization(person, aValidBody());
      expect(created.status).toBe(201);
    }

    const response = await createOrganization(person, aValidBody());

    expect(response.status).toBe(429);
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
  });
});

describe("GET /me/orgs", () => {
  it("answers 401 without a session", async () => {
    const response = await callApi(harness.app, { method: "get", path: "/api/v1/me/orgs" });

    expect(response.status).toBe(401);
  });

  it("lists every organization of one login with the right role keys and leaves out closed ones", async () => {
    const person = await registerViaApi(harness.app);
    const someoneElse = await registerViaApi(harness.app);
    const zed = await createOrganization(person, aValidBody({ name: "Zed Shop" }));
    const alpha = await createOrganization(person, aValidBody({ name: "Alpha Shop" }));
    const closed = await createOrganization(person, aValidBody({ name: "Closed Shop" }));
    const third = await createOrganization(someoneElse, aValidBody({ name: "Third Shop" }));
    await addManagerMember(harness.connections, {
      organizationId: third.body.data.organizationId,
      userId: person.me.userId,
    });
    await closeOrganization(harness.connections, closed.body.data.organizationId);

    const response = await listOrganizations(person);

    expect(response.status).toBe(200);
    expect(
      response.body.data.map((row: { name: string; roleKeys: string[] }) => [
        row.name,
        row.roleKeys,
      ]),
    ).toEqual([
      ["Alpha Shop", ["OWNER"]],
      ["Third Shop", ["MANAGER"]],
      ["Zed Shop", ["OWNER"]],
    ]);
    expect(response.body.data[0].organizationId).toBe(alpha.body.data.organizationId);
    expect(response.body.data[2].organizationId).toBe(zed.body.data.organizationId);
  });

  it("shows a user only their own organizations", async () => {
    const owner = await registerViaApi(harness.app);
    const stranger = await registerViaApi(harness.app);
    await createOrganization(owner, aValidBody());

    const response = await listOrganizations(stranger);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it("runs the same three queries whether the user has one organization or five", async () => {
    const person = await registerViaApi(harness.app);
    const operations: string[] = [];
    mongoose.set("debug", (collectionName: string, method: string) => {
      operations.push(`${collectionName}.${method}`);
    });

    try {
      await createOrganization(person, aValidBody());
      operations.length = 0;
      await listOrganizations(person);
      const withOne = [...operations];
      for (let index = 0; index < 4; index += 1) {
        await createOrganization(person, aValidBody());
      }
      operations.length = 0;
      await listOrganizations(person);

      expect(withOne.sort()).toEqual(["members.find", "organizations.find", "roles.find"]);
      expect([...operations].sort()).toEqual(withOne);
    } finally {
      mongoose.set("debug", false);
    }
  });
});

describe("logs", () => {
  it("never carry the organization name, its slug or the creator's email above debug level", async () => {
    const person = await registerViaApi(harness.app);
    const slug = "secret-shop-slug";

    await createOrganization(person, aValidBody({ name: "Very Secret Name", slug }));
    await listOrganizations(person);

    const DEBUG_LEVEL = 20;
    const loud = harness.logs
      .lines()
      .filter((line) => Number(line["level"]) > DEBUG_LEVEL)
      .map((line) => JSON.stringify(line))
      .join("\n");
    expect(loud).not.toContain("Very Secret Name");
    expect(loud).not.toContain(slug);
    expect(loud).not.toContain(person.email);
  });
});

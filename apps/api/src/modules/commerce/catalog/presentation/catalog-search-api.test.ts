import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  memberWithRole,
  money,
  offeringsPath,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

async function aShop(): Promise<TwoOrganizations> {
  const world = await worldFor(harness, RETAIL);
  const add = (name: string, extra: object = {}) =>
    world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name,
      price: money(1000),
      ...extra,
    });
  await add("Basmati Rice 5kg", { synonyms: ["পোলাও চাল"] });
  await add("চাল মিনিকেট");
  await add("Lentils", {
    price: undefined,
    variants: [{ price: money(500), unitKey: "PIECE", sku: "SKU-77", barcode: "8901234500001" }],
  });
  return world;
}

async function namesFound(world: TwoOrganizations, query: string): Promise<string[]> {
  const response = await world.alice.call(
    "get",
    `${offeringsPath(world.organizationA)}?q=${encodeURIComponent(query)}`,
  );
  expect(response.status).toBe(200);
  return response.body.data.map((row: { name: string }) => row.name).sort();
}

describe("searching offerings", () => {
  it("finds a name by its prefix, in Latin and in Bangla, in any letter case", async () => {
    const world = await aShop();

    expect(await namesFound(world, "bas")).toEqual(["Basmati Rice 5kg"]);
    expect(await namesFound(world, "BASMATI")).toEqual(["Basmati Rice 5kg"]);
    expect(await namesFound(world, "চাল")).toEqual(["চাল মিনিকেট"]);
  });

  it("does not find a word from the middle of a name", async () => {
    const world = await aShop();

    expect(await namesFound(world, "rice")).toEqual([]);
  });

  it("finds an offering by one of its own synonyms", async () => {
    const world = await aShop();

    expect(await namesFound(world, "পোলাও")).toEqual(["Basmati Rice 5kg"]);
  });

  it("finds an exact SKU and an exact barcode, but not a part of one", async () => {
    const world = await aShop();

    expect(await namesFound(world, "SKU-77")).toEqual(["Lentils"]);
    expect(await namesFound(world, "8901234500001")).toEqual(["Lentils"]);
    expect(await namesFound(world, "SKU-7")).toEqual([]);
    expect(await namesFound(world, "890123450000")).toEqual([]);
  });

  it("expands a typed word through the organization's synonyms, in both directions", async () => {
    const world = await aShop();
    const saved = await world.alice.call("put", `/orgs/${world.organizationA}/catalog/synonyms`, {
      entries: [{ term: "চাল", synonyms: ["basmati", "rice"] }],
      version: 0,
    });

    expect(saved.status).toBe(200);
    expect(await namesFound(world, "চাল")).toEqual(["Basmati Rice 5kg", "চাল মিনিকেট"]);
    expect(await namesFound(world, "rice")).toEqual(["Basmati Rice 5kg", "চাল মিনিকেট"]);
  });

  it("keeps the organizations apart", async () => {
    const world = await aShop();

    const response = await world.bob.call("get", `${offeringsPath(world.organizationB)}?q=bas`);

    expect(response.body.data).toEqual([]);
  });
});

describe("the synonym list", () => {
  const synonymsPath = (world: TwoOrganizations) => `/orgs/${world.organizationA}/catalog/synonyms`;

  it("starts empty at version 0 and moves up with each write", async () => {
    const world = await worldFor(harness, RETAIL);

    const empty = await world.alice.call("get", synonymsPath(world));
    const first = await world.alice.call("put", synonymsPath(world), {
      entries: [{ term: "rice", synonyms: ["চাল"] }],
      version: 0,
    });
    const second = await world.alice.call("put", synonymsPath(world), {
      entries: [{ term: "rice", synonyms: ["চাল", "ভাত"] }],
      version: 1,
    });

    expect(empty.body.data).toEqual({ entries: [], version: 0 });
    expect(first.body.data.version).toBe(1);
    expect(second.body.data).toMatchObject({
      version: 2,
      entries: [{ term: "rice", synonyms: ["চাল", "ভাত"] }],
    });
  });

  it("refuses a stale version with 409", async () => {
    const world = await worldFor(harness, RETAIL);
    await world.alice.call("put", synonymsPath(world), { entries: [], version: 0 });

    const stale = await world.alice.call("put", synonymsPath(world), { entries: [], version: 0 });

    expect(stale.status).toBe(409);
  });

  it("refuses the same term twice however it is typed", async () => {
    const world = await worldFor(harness, RETAIL);

    const response = await world.alice.call("put", synonymsPath(world), {
      entries: [
        { term: "Rice", synonyms: ["x"] },
        { term: "rice ", synonyms: ["y"] },
      ],
      version: 0,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields[0].path).toBe("entries.1.term");
  });

  it("is edited by an owner or manager only, but read by anyone who reads the catalog", async () => {
    const world = await worldFor(harness, RETAIL);
    const staff = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.STAFF);

    const read = await staff.call("get", synonymsPath(world));
    const write = await staff.call("put", synonymsPath(world), { entries: [], version: 0 });

    expect(read.status).toBe(200);
    expect(write.status).toBe(403);
  });
});

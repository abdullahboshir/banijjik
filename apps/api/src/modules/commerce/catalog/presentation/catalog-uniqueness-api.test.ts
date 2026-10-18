import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  money,
  offeringsPath,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { pngImage } from "../../../../test-support/file-fixtures.js";
import { uploadFile } from "../../../../test-support/file-upload-client.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import type { ApiActor, TwoOrganizations } from "../../../../test-support/two-organizations.js";
import { buildFileStorage } from "../../../core/file/index.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const uploadRoot = mkdtempSync(join(tmpdir(), "catalog-uniqueness-test-"));
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi({
    fileOverrides: { fileStorage: buildFileStorage({ driver: "local", localRoot: uploadRoot }) },
  });
});

afterAll(async () => {
  await harness.dispose();
  rmSync(uploadRoot, { recursive: true, force: true });
});

function product(name: string, extra: object = {}): object {
  const hasVariants = "variants" in extra;
  return { kind: "PRODUCT", name, ...(hasVariants ? {} : { price: money(1000) }), ...extra };
}

async function createOffering(world: TwoOrganizations, body: object) {
  return world.alice.call("post", offeringsPath(world.organizationA), body);
}

async function createRecord(actor: ApiActor, organizationId: string, path: string, body: object) {
  const response = await actor.call("post", `/orgs/${organizationId}${path}`, body);
  if (response.status !== 201) throw new Error(`${path}: ${response.status}`);
  return response.body.data;
}

async function uploadImage(actor: ApiActor, organizationId: string, purpose: string) {
  const response = await uploadFile(harness.app, actor, {
    organizationId,
    bytes: await pngImage(),
    filename: "a.png",
    purpose,
  });
  if (response.status !== 201) throw new Error(`upload ${purpose}: ${response.status}`);
  return response.body.data.fileId as string;
}

describe("SKU uniqueness", () => {
  it("refuses a SKU that another offering holds, naming that offering", async () => {
    const world = await worldFor(harness, RETAIL);
    const first = await createOffering(
      world,
      product("Rice", { variants: [{ price: money(100), unitKey: "PIECE", sku: "RICE-1" }] }),
    );

    const second = await createOffering(
      world,
      product("Lentils", { variants: [{ price: money(100), unitKey: "PIECE", sku: "RICE-1" }] }),
    );

    expect(second.status).toBe(409);
    expect(second.body.error.messageKey).toBe("errors.offering_sku_taken");
    expect(second.body.error.details).toMatchObject({
      sku: "RICE-1",
      offeringId: first.body.data.offeringId,
    });
  });

  it("lets another organization use the same SKU", async () => {
    const world = await worldFor(harness, RETAIL);
    await createOffering(
      world,
      product("Rice", { variants: [{ price: money(1), unitKey: "PIECE", sku: "SHARED" }] }),
    );

    const other = await world.bob.call(
      "post",
      offeringsPath(world.organizationB),
      product("Rice", {
        variants: [{ price: money(1), unitKey: "PIECE", sku: "SHARED" }],
      }),
    );

    expect(other.status).toBe(201);
  });

  it("refuses the same SKU twice in one offering", async () => {
    const world = await worldFor(harness, RETAIL);

    const response = await createOffering(
      world,
      product("Shirt", {
        variants: [
          { name: "M", price: money(1), unitKey: "PIECE", sku: "SAME" },
          { name: "L", price: money(1), unitKey: "PIECE", sku: "SAME" },
        ],
      }),
    );

    expect(response.status).toBe(400);
  });

  it("lets only one of two concurrent creates with one SKU through", async () => {
    const world = await worldFor(harness, RETAIL);
    const body = (name: string) =>
      product(name, { variants: [{ price: money(1), unitKey: "PIECE", sku: "RACE-1" }] });

    const responses = await Promise.all([
      createOffering(world, body("Race one")),
      createOffering(world, body("Race two")),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const loser = responses.find((response) => response.status === 409);
    expect(loser?.body.error.details.sku).toBe("RACE-1");
  });
});

describe("slugs", () => {
  it("makes a slug from a Latin name and numbers a duplicate name", async () => {
    const world = await worldFor(harness, RETAIL);

    const first = await createOffering(world, product("Basmati Rice 5kg"));
    const second = await createOffering(world, product("Basmati Rice 5kg"));
    const third = await createOffering(world, product("Basmati Rice 5kg"));

    expect([first, second, third].map((response) => response.body.data.slug)).toEqual([
      "basmati-rice-5kg",
      "basmati-rice-5kg-2",
      "basmati-rice-5kg-3",
    ]);
  });

  it("gives a Bangla name a slug made from the end of its id", async () => {
    const world = await worldFor(harness, RETAIL);

    const response = await createOffering(world, product("মিনিকেট চাল"));

    const { offeringId, slug } = response.body.data;
    expect(slug).toBe(`o-${offeringId.slice(-8)}`);
  });

  it("keeps a chosen slug and refuses one that is taken", async () => {
    const world = await worldFor(harness, RETAIL);
    await createOffering(world, product("Tea", { slug: "tea" }));

    const chosen = await createOffering(world, product("Green tea", { slug: "green-tea" }));
    const taken = await createOffering(world, product("Black tea", { slug: "tea" }));

    expect(chosen.body.data.slug).toBe("green-tea");
    expect(taken.status).toBe(409);
    expect(taken.body.error.messageKey).toBe("errors.offering_slug_taken");
  });

  it("keeps the slug when the offering is renamed", async () => {
    const world = await worldFor(harness, RETAIL);
    const created = await createOffering(world, product("Tea"));

    const renamed = await world.alice.call(
      "patch",
      offeringsPath(world.organizationA, `/${created.body.data.offeringId}`),
      { name: "Green tea", version: 1 },
    );

    expect(renamed.body.data).toMatchObject({ name: "Green tea", slug: "tea" });
  });
});

describe("a repeated create", () => {
  it("returns the first answer and creates nothing new", async () => {
    const world = await worldFor(harness, RETAIL);
    const path = offeringsPath(world.organizationA);
    const call = {
      method: "post",
      path,
      body: product("Idempotent"),
      idempotencyKey: newId(),
    } as const;

    const first = await world.alice.callWith(call);
    const again = await world.alice.callWith(call);

    expect(first.status).toBe(201);
    expect(again.status).toBe(201);
    expect(again.body.data.offeringId).toBe(first.body.data.offeringId);
    expect(again.headers["idempotency-replayed"]).toBe("true");
    const list = await world.alice.call("get", `${path}?q=Idempotent`);
    expect(list.body.data).toHaveLength(1);
  });
});

describe("what an offering may name", () => {
  it("accepts an active category, an add-on group and an offering image of this organization", async () => {
    const world = await worldFor(harness, RETAIL);
    const category = await createRecord(world.alice, world.organizationA, "/categories", {
      name: "Grocery",
    });
    const group = await createRecord(world.alice, world.organizationA, "/modifier-groups", {
      name: "Extras",
      selection: "MULTIPLE",
      isRequired: false,
      minSelect: 0,
      maxSelect: 1,
      options: [{ name: "Gift wrap", priceDelta: money(2000) }],
    });
    const fileId = await uploadImage(world.alice, world.organizationA, "OFFERING_IMAGE");

    const response = await createOffering(
      world,
      product("Rice", {
        categoryIds: [category.categoryId],
        modifierGroupIds: [group.modifierGroupId],
        imageFileIds: [fileId],
      }),
    );

    expect(response.status).toBe(201);
    expect(response.body.data.categories).toEqual([
      { referenceId: category.categoryId, name: "Grocery" },
    ]);
    expect(response.body.data.modifierGroups).toEqual([
      { referenceId: group.modifierGroupId, name: "Extras" },
    ]);
    expect(response.body.data.images).toEqual([
      { fileId, url: `/api/v1/public/files/${fileId}/medium` },
    ]);
  });

  it("refuses another organization's category, group and image, each at its own path", async () => {
    const world = await worldFor(harness, RETAIL);
    const category = await createRecord(world.bob, world.organizationB, "/categories", {
      name: "Theirs",
    });
    const group = await createRecord(world.bob, world.organizationB, "/modifier-groups", {
      name: "Theirs",
      selection: "SINGLE",
      isRequired: true,
      minSelect: 1,
      maxSelect: 1,
      options: [{ name: "One", priceDelta: money(0) }],
    });
    const fileId = await uploadImage(world.bob, world.organizationB, "OFFERING_IMAGE");

    const response = await createOffering(
      world,
      product("Rice", {
        categoryIds: [category.categoryId],
        modifierGroupIds: [group.modifierGroupId],
        imageFileIds: [fileId],
      }),
    );

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields.map((field: { path: string }) => field.path)).toEqual(
      ["categoryIds.0", "modifierGroupIds.0", "imageFileIds.0"],
    );
  });

  it("refuses an image that was uploaded as a logo", async () => {
    const world = await worldFor(harness, RETAIL);
    const logoId = await uploadImage(world.alice, world.organizationA, "LOGO");

    const response = await createOffering(world, product("Rice", { imageFileIds: [logoId] }));

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields[0].path).toBe("imageFileIds.0");
  });

  it("refuses an archived category", async () => {
    const world = await worldFor(harness, RETAIL);
    const category = await createRecord(world.alice, world.organizationA, "/categories", {
      name: "Old",
    });
    await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/categories/${category.categoryId}/archive`,
      { version: 1 },
    );

    const response = await createOffering(
      world,
      product("Rice", { categoryIds: [category.categoryId] }),
    );

    expect(response.status).toBe(400);
  });

  it("refuses to archive a category that an active offering uses, with the counts", async () => {
    const world = await worldFor(harness, RETAIL);
    const category = await createRecord(world.alice, world.organizationA, "/categories", {
      name: "Used",
    });
    const created = await createOffering(
      world,
      product("Rice", { categoryIds: [category.categoryId] }),
    );
    await world.alice.call(
      "post",
      offeringsPath(world.organizationA, `/${created.body.data.offeringId}/publish`),
      { version: 1 },
    );

    const response = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/categories/${category.categoryId}/archive`,
      { version: 1 },
    );

    expect(response.status).toBe(422);
    expect(response.body.error.details).toMatchObject({
      ruleKey: "CATEGORY_IN_USE",
      offerings: 1,
      childCategories: 0,
    });
  });
});

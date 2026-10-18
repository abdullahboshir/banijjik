import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  memberWithRole,
  money,
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

const categoriesPath = (world: TwoOrganizations, suffix = "") =>
  `/orgs/${world.organizationA}/categories${suffix}`;
const groupsPath = (world: TwoOrganizations, suffix = "") =>
  `/orgs/${world.organizationA}/modifier-groups${suffix}`;

async function addCategory(world: TwoOrganizations, name: string, parentCategoryId?: string) {
  const response = await world.alice.call("post", categoriesPath(world), {
    name,
    ...(parentCategoryId === undefined ? {} : { parentCategoryId }),
  });
  return response;
}

describe("categories", () => {
  it("adds a category with a slug, lists them flat in order, and keeps the parent link", async () => {
    const world = await worldFor(harness, RETAIL);
    const root = await world.alice.call("post", categoriesPath(world), {
      name: "Grocery",
      sortOrder: 2,
    });
    const child = await addCategory(world, "Rice", root.body.data.categoryId);
    await world.alice.call("post", categoriesPath(world), { name: "Drinks", sortOrder: 1 });

    const list = await world.alice.call("get", categoriesPath(world));

    expect(root.body.data).toMatchObject({ slug: "grocery", status: "ACTIVE", version: 1 });
    expect(child.body.data.parentCategoryId).toBe(root.body.data.categoryId);
    // Sorted by sortOrder (Rice has the default 0), not by tree position.
    expect(list.body.data.map((row: { name: string }) => row.name)).toEqual([
      "Rice",
      "Drinks",
      "Grocery",
    ]);
  });

  it("allows three levels and refuses a fourth, at parentCategoryId", async () => {
    const world = await worldFor(harness, RETAIL);
    const one = await addCategory(world, "One");
    const two = await addCategory(world, "Two", one.body.data.categoryId);
    const three = await addCategory(world, "Three", two.body.data.categoryId);

    const four = await addCategory(world, "Four", three.body.data.categoryId);

    expect(three.status).toBe(201);
    expect(four.status).toBe(400);
    expect(four.body.error.details.fields).toEqual([
      { path: "parentCategoryId", messageKey: "errors.category_too_deep" },
    ]);
  });

  it("refuses a move that makes a cycle, and a move that makes the tree too deep", async () => {
    const world = await worldFor(harness, RETAIL);
    const one = await addCategory(world, "One");
    const two = await addCategory(world, "Two", one.body.data.categoryId);
    const three = await addCategory(world, "Three", two.body.data.categoryId);
    const lone = await addCategory(world, "Lone");

    const cycle = await world.alice.call(
      "patch",
      categoriesPath(world, `/${one.body.data.categoryId}`),
      {
        parentCategoryId: three.body.data.categoryId,
        version: 1,
      },
    );
    const tooDeep = await world.alice.call(
      "patch",
      categoriesPath(world, `/${one.body.data.categoryId}`),
      {
        parentCategoryId: lone.body.data.categoryId,
        version: 1,
      },
    );
    const moved = await world.alice.call(
      "patch",
      categoriesPath(world, `/${lone.body.data.categoryId}`),
      {
        parentCategoryId: one.body.data.categoryId,
        version: 1,
      },
    );

    expect(cycle.body.error.details.fields[0].messageKey).toBe("errors.category_cycle");
    expect(tooDeep.body.error.details.fields[0].messageKey).toBe("errors.category_too_deep");
    expect(moved.status).toBe(200);
  });

  it("refuses to archive a category with an active child, with the count", async () => {
    const world = await worldFor(harness, RETAIL);
    const parent = await addCategory(world, "Parent");
    await addCategory(world, "Child", parent.body.data.categoryId);

    const response = await world.alice.call(
      "post",
      categoriesPath(world, `/${parent.body.data.categoryId}/archive`),
      { version: 1 },
    );

    expect(response.status).toBe(422);
    expect(response.body.error.details).toMatchObject({ childCategories: 1, offerings: 0 });
  });

  it("hides an archived category from the default list and shows it when asked", async () => {
    const world = await worldFor(harness, RETAIL);
    const category = await addCategory(world, "Old");
    await world.alice.call(
      "post",
      categoriesPath(world, `/${category.body.data.categoryId}/archive`),
      { version: 1 },
    );

    const active = await world.alice.call("get", categoriesPath(world));
    const archived = await world.alice.call("get", `${categoriesPath(world)}?status=ARCHIVED`);

    expect(active.body.data).toEqual([]);
    expect(archived.body.data).toHaveLength(1);
  });

  it("numbers a repeated name and answers 404 for another organization's category", async () => {
    const world = await worldFor(harness, RETAIL);
    const first = await addCategory(world, "Tea");
    const second = await addCategory(world, "Tea");

    const foreign = await world.bob.call(
      "get",
      `/orgs/${world.organizationB}/categories/${first.body.data.categoryId}`,
    );

    expect([first.body.data.slug, second.body.data.slug]).toEqual(["tea", "tea-2"]);
    expect(foreign.status).toBe(404);
  });

  it("lets staff read and refuses them writes", async () => {
    const world = await worldFor(harness, RETAIL);
    const staff = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.STAFF);

    const read = await staff.call("get", categoriesPath(world));
    const write = await staff.call("post", categoriesPath(world), { name: "Nope" });

    expect([read.status, write.status]).toEqual([200, 403]);
  });
});

describe("add-on groups", () => {
  const sizeGroup = {
    name: "Size",
    selection: "SINGLE",
    isRequired: true,
    minSelect: 1,
    maxSelect: 1,
    options: [
      { name: "Small", priceDelta: money(0) },
      { name: "Large", priceDelta: money(3000) },
    ],
  };

  it("adds a group with its options and reads it back", async () => {
    const world = await worldFor(harness, RETAIL);

    const created = await world.alice.call("post", groupsPath(world), sizeGroup);
    const read = await world.alice.call(
      "get",
      groupsPath(world, `/${created.body.data.modifierGroupId}`),
    );

    expect(created.status).toBe(201);
    expect(read.body.data.options.map((option: { name: string }) => option.name)).toEqual([
      "Small",
      "Large",
    ]);
    expect(read.body.data.options[1]).toMatchObject({ priceDelta: money(3000), status: "ACTIVE" });
  });

  it("keeps an option's id when it is sent again and archives an option left out", async () => {
    const world = await worldFor(harness, RETAIL);
    const created = await world.alice.call("post", groupsPath(world), sizeGroup);
    const [small, large] = created.body.data.options;

    const updated = await world.alice.call(
      "patch",
      groupsPath(world, `/${created.body.data.modifierGroupId}`),
      {
        version: 1,
        options: [
          { modifierOptionId: small.modifierOptionId, name: "Small", priceDelta: money(500) },
          { name: "Medium", priceDelta: money(1500) },
        ],
      },
    );

    expect(updated.status).toBe(200);
    const byId = new Map(
      updated.body.data.options.map((option: { modifierOptionId: string }) => [
        option.modifierOptionId,
        option,
      ]),
    );
    expect(byId.get(small.modifierOptionId)).toMatchObject({
      priceDelta: money(500),
      status: "ACTIVE",
    });
    expect(byId.get(large.modifierOptionId)).toMatchObject({ status: "ARCHIVED" });
    expect(updated.body.data.options).toHaveLength(3);
  });

  it("refuses settings that disagree with the choices", async () => {
    const world = await worldFor(harness, RETAIL);

    const tooMany = await world.alice.call("post", groupsPath(world), {
      ...sizeGroup,
      selection: "MULTIPLE",
      isRequired: false,
      minSelect: 0,
      maxSelect: 3,
    });
    const archivedCounts = await world.alice.call("post", groupsPath(world), sizeGroup);
    const unknownOption = await world.alice.call(
      "patch",
      groupsPath(world, `/${archivedCounts.body.data.modifierGroupId}`),
      {
        version: 1,
        options: [
          {
            modifierOptionId: "0198aaaa-0000-7000-8000-000000000009",
            name: "X",
            priceDelta: money(0),
          },
        ],
      },
    );

    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.details.fields[0].messageKey).toBe(
      "errors.modifier_group_selection_invalid",
    );
    expect(unknownOption.status).toBe(400);
  });

  it("archives a group and answers 404 for another organization's group", async () => {
    const world = await worldFor(harness, RETAIL);
    const created = await world.alice.call("post", groupsPath(world), sizeGroup);
    const id = created.body.data.modifierGroupId;

    const foreign = await world.bob.call(
      "get",
      `/orgs/${world.organizationB}/modifier-groups/${id}`,
    );
    const archived = await world.alice.call("post", groupsPath(world, `/${id}/archive`), {
      version: 1,
    });
    const again = await world.alice.call("post", groupsPath(world, `/${id}/archive`), {
      version: 2,
    });

    expect(foreign.status).toBe(404);
    expect(archived.body.data.status).toBe("ARCHIVED");
    expect(again.status).toBe(409);
  });
});

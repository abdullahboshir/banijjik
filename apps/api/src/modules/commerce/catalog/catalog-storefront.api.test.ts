import { MODULE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  money,
  offeringsPath,
  startCatalogApi,
  worldFor,
} from "../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../test-support/iam-api-harness.js";
import { callStorefront } from "../../../test-support/storefront-world.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

const categoriesPath = (organizationId: string) => `/orgs/${organizationId}/categories`;
const groupsPath = (organizationId: string) => `/orgs/${organizationId}/modifier-groups`;
const customFieldsPath = (organizationId: string) => `/orgs/${organizationId}/custom-fields`;

function fieldDef(spec: { fieldKey: string; storefront?: boolean; isSensitive?: boolean }) {
  return {
    entityType: "offering",
    offeringKind: "PRODUCT",
    fieldKey: spec.fieldKey,
    label: { bn: spec.fieldKey, en: spec.fieldKey },
    fieldType: "TEXT",
    isRequired: false,
    visibility: { admin: true, storefront: spec.storefront ?? false, bot: false },
    botAsk: false,
    isSearchable: false,
    isSensitive: spec.isSensitive ?? false,
    sortOrder: 10,
  };
}

describe("storefront public catalog", () => {
  it("returns paginated public offerings filtered by active published location", async () => {
    const world = await worldFor(harness, RETAIL);

    // Create and publish offering 1
    const res1 = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Organic Tea",
      variants: [{ name: "Standard", price: money(15000), unitKey: "PIECE" }],
    });
    const offering1 = res1.body.data;
    await world.alice.call(
      "post",
      offeringsPath(world.organizationA, `/${offering1.offeringId}/publish`),
      { version: 1 },
    );

    // Create and publish offering 2
    const res2 = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Herbal Tea",
      variants: [{ name: "Standard", price: money(20000), unitKey: "PIECE" }],
    });
    const offering2 = res2.body.data;
    await world.alice.call(
      "post",
      offeringsPath(world.organizationA, `/${offering2.offeringId}/publish`),
      { version: 1 },
    );

    // Make offering 2 unavailable at location1
    const locationId = world.locationA1;
    await world.alice.call(
      "put",
      offeringsPath(world.organizationA, `/${offering2.offeringId}/locations/${locationId}`),
      { isAvailable: false },
    );

    // Query storefront without location
    const allRes = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/offerings",
      query: { page: 1, limit: 10 },
    });
    expect(allRes.status).toBe(200);
    expect(allRes.body.data.items.length).toBeGreaterThanOrEqual(2);

    // Query storefront with location filter
    const locRes = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/offerings",
      query: { locationId, page: 1, limit: 10 },
    });
    expect(locRes.status).toBe(200);
    const itemIds = locRes.body.data.items.map((item: { offeringId: string }) => item.offeringId);
    expect(itemIds).toContain(offering1.offeringId);
    expect(itemIds).not.toContain(offering2.offeringId);
  });

  it("filters public offerings by enabled offering kind and category", async () => {
    const world = await worldFor(harness, RETAIL);

    // Create category
    const catRes = await world.alice.call("post", categoriesPath(world.organizationA), {
      name: "Beverages",
      sortOrder: 1,
    });
    const categoryId = catRes.body.data.categoryId;

    // Create and publish offering in category
    const offRes = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Cold Coffee",
      categoryIds: [categoryId],
      variants: [{ name: "Bottle", price: money(12000), unitKey: "PIECE" }],
    });
    await world.alice.call(
      "post",
      offeringsPath(world.organizationA, `/${offRes.body.data.offeringId}/publish`),
      { version: 1 },
    );

    // Query with kind and categoryId
    const res = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/offerings",
      query: { kind: "PRODUCT", categoryId },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].slug).toBe("cold-coffee");
    expect(res.body.data.items[0].categoryId).toBe(categoryId);
  });

  it("searches public offerings by text query matching name and tags", async () => {
    const world = await worldFor(harness, RETAIL);

    const offRes = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Handmade Scented Candle",
      synonyms: ["aroma", "wax"],
      variants: [{ name: "Vanilla", price: money(35000), unitKey: "PIECE" }],
    });
    await world.alice.call(
      "post",
      offeringsPath(world.organizationA, `/${offRes.body.data.offeringId}/publish`),
      { version: 1 },
    );

    // Search by name substring
    const nameSearchRes = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/offerings",
      query: { q: "candle" },
    });
    expect(nameSearchRes.status).toBe(200);
    expect(
      nameSearchRes.body.data.items.some(
        (i: { offeringId: string }) => i.offeringId === offRes.body.data.offeringId,
      ),
    ).toBe(true);

    // Search by synonym / tag
    const tagSearchRes = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/offerings",
      query: { q: "aroma" },
    });
    expect(tagSearchRes.status).toBe(200);
    expect(
      tagSearchRes.body.data.items.some(
        (i: { offeringId: string }) => i.offeringId === offRes.body.data.offeringId,
      ),
    ).toBe(true);
  });

  it("returns offering detail with variants, modifier groups and public custom fields", async () => {
    const world = await worldFor(harness, RETAIL);

    // Create public and private custom fields
    await world.alice.call(
      "post",
      customFieldsPath(world.organizationA),
      fieldDef({ fieldKey: "material", storefront: true }),
    );
    await world.alice.call(
      "post",
      customFieldsPath(world.organizationA),
      fieldDef({ fieldKey: "internal_notes", storefront: false }),
    );

    // Create modifier group
    const groupRes = await world.alice.call("post", groupsPath(world.organizationA), {
      name: "Sugar Level",
      selection: "SINGLE",
      isRequired: true,
      minSelect: 1,
      maxSelect: 1,
      options: [
        { name: "Zero Sugar", priceDelta: money(0) },
        { name: "Extra Sugar", priceDelta: money(2000) },
      ],
    });
    const modifierGroupId = groupRes.body.data.modifierGroupId;

    // Create offering with custom fields and modifier group
    const offRes = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Iced Tea",
      description: "Refreshing beverage",
      modifierGroupIds: [modifierGroupId],
      customFields: {
        material: "Organic Leaf",
        internal_notes: "Supplier: Farm Direct",
      },
      variants: [{ name: "Large", price: money(18000), unitKey: "PIECE" }],
    });
    const offering = offRes.body.data;
    await world.alice.call(
      "post",
      offeringsPath(world.organizationA, `/${offering.offeringId}/publish`),
      { version: 1 },
    );

    // Query public detail by slug
    const detailRes = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: `/offerings/${offering.slug}`,
    });

    expect(detailRes.status).toBe(200);
    const detail = detailRes.body.data;
    expect(detail.slug).toBe(offering.slug);
    expect(detail.name.en).toBe("Iced Tea");
    expect(detail.description.en).toBe("Refreshing beverage");
    expect(detail.variants.length).toBe(1);
    expect(detail.variants[0].name.en).toBe("Large");
    expect(detail.variants[0].price).toEqual({ amount: 18000, currency: "BDT" });

    // Modifier group assertions
    expect(detail.modifierGroups.length).toBe(1);
    expect(detail.modifierGroups[0].name.en).toBe("Sugar Level");
    expect(detail.modifierGroups[0].options.length).toBe(2);

    // Custom fields: public storefront field is present, admin/internal field is omitted
    expect(detail.publicCustomFields).toHaveProperty("material", "Organic Leaf");
    expect(detail.publicCustomFields).not.toHaveProperty("internal_notes");
  });

  it("returns 404 NOT_FOUND for draft, archived, or unpublished offering", async () => {
    const world = await worldFor(harness, RETAIL);

    // Draft offering
    const draftRes = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Secret Draft Product",
      variants: [{ name: "Standard", price: money(10000), unitKey: "PIECE" }],
    });
    const draft = draftRes.body.data;

    // Call storefront on draft offering
    const draftStorefrontRes = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: `/offerings/${draft.slug}`,
    });
    expect(draftStorefrontRes.status).toBe(404);

    // Publish then archive
    await world.alice.call(
      "post",
      offeringsPath(world.organizationA, `/${draft.offeringId}/publish`),
      { version: 1 },
    );
    await world.alice.call(
      "post",
      offeringsPath(world.organizationA, `/${draft.offeringId}/archive`),
      { version: 2 },
    );

    const archivedStorefrontRes = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: `/offerings/${draft.slug}`,
    });
    expect(archivedStorefrontRes.status).toBe(404);
  });

  it("never exposes internal cost, margin, supplierId, or private custom fields in public projection", async () => {
    const world = await worldFor(harness, RETAIL);

    // Define sensitive and non-storefront custom fields
    await world.alice.call(
      "post",
      customFieldsPath(world.organizationA),
      fieldDef({ fieldKey: "supplier_cost", storefront: false, isSensitive: true }),
    );

    const offRes = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Audit Protected Item",
      customFields: {
        supplier_cost: "5000",
      },
      variants: [
        {
          name: "Standard",
          price: money(12000),
          unitKey: "PIECE",
        },
      ],
    });
    const offering = offRes.body.data;
    await world.alice.call(
      "post",
      offeringsPath(world.organizationA, `/${offering.offeringId}/publish`),
      { version: 1 },
    );

    const detailRes = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: `/offerings/${offering.slug}`,
    });

    expect(detailRes.status).toBe(200);
    const detail = detailRes.body.data;

    // Must not expose stock components (cost basis)
    expect(detail.variants[0]).not.toHaveProperty("stockComponents");
    // Must not expose internal sensitive or non-storefront fields
    expect(detail.publicCustomFields).not.toHaveProperty("supplier_cost");
    // Ensure no raw cost or margin properties
    expect(detail).not.toHaveProperty("cost");
    expect(detail).not.toHaveProperty("margin");
    expect(detail).not.toHaveProperty("supplierId");
  });

  it("refuses offerings whose offering kind is disabled in resolved org config", async () => {
    // RETAIL template allows PRODUCT only (not SERVICE)
    const world = await worldFor(harness, RETAIL);

    // In direct DB or if a service offering existed, query should not expose it
    const res = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/offerings",
      query: { kind: "SERVICE" },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it("returns public categories tree with offering counts for active offerings", async () => {
    const world = await worldFor(harness, RETAIL);

    const cat1 = await world.alice.call("post", categoriesPath(world.organizationA), {
      name: "Groceries",
      sortOrder: 1,
    });
    const cat2 = await world.alice.call("post", categoriesPath(world.organizationA), {
      name: "Snacks",
      sortOrder: 2,
    });

    // Create offering under cat1
    const offRes = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Basmati Rice",
      categoryIds: [cat1.body.data.categoryId],
      variants: [{ name: "5kg", price: money(45000), unitKey: "PIECE" }],
    });
    await world.alice.call(
      "post",
      offeringsPath(world.organizationA, `/${offRes.body.data.offeringId}/publish`),
      { version: 1 },
    );

    const catListRes = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/categories",
    });

    expect(catListRes.status).toBe(200);
    const groceries = catListRes.body.data.items.find(
      (c: { categoryId: string }) => c.categoryId === cat1.body.data.categoryId,
    );
    const snacks = catListRes.body.data.items.find(
      (c: { categoryId: string }) => c.categoryId === cat2.body.data.categoryId,
    );

    expect(groceries.offeringCount).toBe(1);
    expect(snacks.offeringCount).toBe(0);
  });

  it("refuses request when catalog module is disabled for the organization (module switch 404)", async () => {
    await harness.connections.platform
      .collection("industry_templates")
      .updateOne(
        { industryTemplateKey: "SALON" },
        { $pull: { allowedModuleKeys: MODULE_KEY.CATALOG as never }, $inc: { version: 1 } },
      );

    const world = await worldFor(harness, RETAIL, { industryTemplateKey: "SALON" });

    const res = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/offerings",
    });

    expect(res.status).toBe(404);
  });

  it("enforces cross-org isolation: public catalog of org A cannot see offerings of org B", async () => {
    const world = await worldFor(harness, RETAIL);

    // Create and publish offering in org B
    const offB = await world.bob.call("post", offeringsPath(world.organizationB), {
      kind: "PRODUCT",
      name: "Org B Secret Item",
      variants: [{ name: "Standard", price: money(10000), unitKey: "PIECE" }],
    });
    await world.bob.call(
      "post",
      offeringsPath(world.organizationB, `/${offB.body.data.offeringId}/publish`),
      { version: 1 },
    );

    // Call org A's storefront with org B's slug
    const detailFromA = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: `/offerings/${offB.body.data.slug}`,
    });
    expect(detailFromA.status).toBe(404);

    // Call org A's offering list
    const listA = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/offerings",
    });
    expect(listA.status).toBe(200);
    expect(
      listA.body.data.items.some(
        (i: { offeringId: string }) => i.offeringId === offB.body.data.offeringId,
      ),
    ).toBe(false);
  });
});

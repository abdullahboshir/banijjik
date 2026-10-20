import { ALL_LOCATIONS, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  money,
  memberWithRole,
  offeringsPath,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  countAuditRows,
  countOutboxRows,
  createCustomRoleAs,
} from "../../../../test-support/organization-tenant-world.js";
import { addMemberWithAssignments } from "../../../../test-support/rbac-world.js";
import type { ApiActor } from "../../../../test-support/two-organizations.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

interface PublishedOffering {
  readonly offeringId: string;
  readonly version: number;
  readonly variants: readonly { variantId: string }[];
}

async function publishOffering(
  actor: ApiActor,
  organizationId: string,
  body: object,
): Promise<PublishedOffering> {
  const created = await actor.call("post", offeringsPath(organizationId), body);
  expect(created.status).toBe(201);
  const published = await actor.call(
    "post",
    offeringsPath(organizationId, `/${created.body.data.offeringId}/publish`),
    { version: created.body.data.version },
  );
  expect(published.status).toBe(200);
  return published.body.data as PublishedOffering;
}

function firstVariantId(offering: PublishedOffering): string {
  const variant = offering.variants[0];
  if (variant === undefined) throw new Error("expected a published variant");
  return variant.variantId;
}

describe("tax classes", () => {
  it("creates, lists ACTIVE by default, archives, and audits", async () => {
    const world = await worldFor(harness, RETAIL, RETAIL);
    const created = await world.alice.call("post", `/orgs/${world.organizationA}/tax-classes`, {
      taxClassKey: "vat-standard",
      name: "VAT 7.5%",
      rateBasisPoints: 750,
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      taxClassKey: "vat-standard",
      rateBasisPoints: 750,
      status: "ACTIVE",
      version: 1,
    });

    const listed = await world.alice.call("get", `/orgs/${world.organizationA}/tax-classes`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.map((row: { taxClassKey: string }) => row.taxClassKey)).toContain(
      "vat-standard",
    );

    const archived = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/tax-classes/${created.body.data.taxClassId}/archive`,
      { version: 1 },
    );
    expect(archived.status).toBe(200);
    expect(archived.body.data.status).toBe("ARCHIVED");

    const activeOnly = await world.alice.call("get", `/orgs/${world.organizationA}/tax-classes`);
    expect(
      activeOnly.body.data.map((row: { taxClassKey: string }) => row.taxClassKey),
    ).not.toContain("vat-standard");

    const withArchived = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/tax-classes?status=ARCHIVED`,
    );
    expect(withArchived.body.data.map((row: { taxClassKey: string }) => row.taxClassKey)).toContain(
      "vat-standard",
    );

    expect(
      await countAuditRows(harness.connections, {
        organizationId: world.organizationA,
        action: "pricing.taxClass.created",
        entityId: created.body.data.taxClassId,
      }),
    ).toBe(1);
  });

  it("lets a cashier list tax classes but not create them", async () => {
    const world = await worldFor(harness, RETAIL, RETAIL);
    const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
    await world.alice.call("post", `/orgs/${world.organizationA}/tax-classes`, {
      taxClassKey: "zero",
      name: "Zero",
      rateBasisPoints: 0,
    });
    const listed = await cashier.call("get", `/orgs/${world.organizationA}/tax-classes`);
    expect(listed.status).toBe(200);
    const created = await cashier.call("post", `/orgs/${world.organizationA}/tax-classes`, {
      taxClassKey: "denied",
      name: "Denied",
      rateBasisPoints: 0,
    });
    expect(created.status).toBe(403);
  });
});

describe("promotions and quotes", () => {
  it("creates a promotion, quotes with it, and emits the change event", async () => {
    const world = await worldFor(harness, RETAIL, RETAIL);
    const category = await world.alice.call("post", `/orgs/${world.organizationA}/categories`, {
      name: "Rice",
      sortOrder: 1,
    });
    expect(category.status).toBe(201);
    const offering = await publishOffering(world.alice, world.organizationA, {
      kind: "PRODUCT",
      name: "Loose rice",
      categoryIds: [category.body.data.categoryId],
      kindDetails: { requiresShipping: true },
      variants: [
        {
          name: "Default",
          price: money(8000),
          unitKey: "KG",
          quantityRule: { min: 250, step: 250 },
        },
      ],
    });
    const promotion = await world.alice.call("post", `/orgs/${world.organizationA}/promotions`, {
      name: "Ten percent off rice",
      priority: 10,
      target: { scope: "CATEGORY", ids: [category.body.data.categoryId] },
      benefit: { type: "PERCENT", value: 1000 },
      status: undefined,
    });
    expect(promotion.status).toBe(201);
    const activated = await world.alice.call(
      "patch",
      `/orgs/${world.organizationA}/promotions/${promotion.body.data.promotionId}`,
      { version: 1, status: "ACTIVE" },
    );
    expect(activated.status).toBe(200);
    expect(activated.body.data.status).toBe("ACTIVE");
    expect(
      await countOutboxRows(harness.connections, {
        organizationId: world.organizationA,
        type: "pricing.promotion.changed",
        "payload.promotionId": promotion.body.data.promotionId,
      }),
    ).toBeGreaterThanOrEqual(1);

    const quote = await world.alice.call("post", `/orgs/${world.organizationA}/quotes`, {
      locationId: world.locationA1,
      lines: [
        {
          offeringId: offering.offeringId,
          variantId: firstVariantId(offering),
          quantity: 1250,
        },
      ],
    });
    expect(quote.status).toBe(200);
    expect(quote.body.data.lines[0].lineGross.amount).toBe(10_000);
    expect(quote.body.data.lines[0].promotionDiscount.amount).toBe(1000);
    expect(quote.body.data.lines[0].promotionIds).toEqual([promotion.body.data.promotionId]);
  });

  it("refuses an unknown default tax class on quote", async () => {
    const world = await worldFor(harness, RETAIL, RETAIL);
    const offering = await publishOffering(world.alice, world.organizationA, {
      kind: "PRODUCT",
      name: "Soap",
      kindDetails: { requiresShipping: true },
      variants: [{ name: "Default", price: money(5000), unitKey: "PIECE" }],
    });
    await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [{ settingKey: "pricing.defaultTaxClassKey", value: "missing-class" }],
    });
    const quote = await world.alice.call("post", `/orgs/${world.organizationA}/quotes`, {
      locationId: world.locationA1,
      lines: [
        {
          offeringId: offering.offeringId,
          variantId: firstVariantId(offering),
          quantity: 1,
        },
      ],
    });
    expect(quote.status).toBe(422);
    expect(quote.body.error.details.ruleKey).toBe("TAX_CLASS_UNKNOWN");
    expect(quote.body.error.details.taxClassKey).toBe("missing-class");
  });

  it("refuses an archived default tax class on quote", async () => {
    const world = await worldFor(harness, RETAIL, RETAIL);
    const created = await world.alice.call("post", `/orgs/${world.organizationA}/tax-classes`, {
      taxClassKey: "old-vat",
      name: "Old VAT",
      rateBasisPoints: 750,
    });
    expect(created.status).toBe(201);
    await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/tax-classes/${created.body.data.taxClassId}/archive`,
      { version: 1 },
    );
    await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [{ settingKey: "pricing.defaultTaxClassKey", value: "old-vat" }],
    });
    const offering = await publishOffering(world.alice, world.organizationA, {
      kind: "PRODUCT",
      name: "Brush",
      kindDetails: { requiresShipping: true },
      variants: [{ name: "Default", price: money(2000), unitKey: "PIECE" }],
    });
    const quote = await world.alice.call("post", `/orgs/${world.organizationA}/quotes`, {
      locationId: world.locationA1,
      lines: [
        {
          offeringId: offering.offeringId,
          variantId: firstVariantId(offering),
          quantity: 1,
        },
      ],
    });
    expect(quote.status).toBe(422);
    expect(quote.body.error.details.ruleKey).toBe("TAX_CLASS_UNKNOWN");
    expect(quote.body.error.details.taxClassKey).toBe("old-vat");
  });

  it("flags a manual discount above the amount threshold and ignores amount when it is 0", async () => {
    const world = await worldFor(harness, RETAIL, RETAIL);
    const offering = await publishOffering(world.alice, world.organizationA, {
      kind: "PRODUCT",
      name: "Cup",
      kindDetails: { requiresShipping: true },
      variants: [{ name: "Default", price: money(10_000), unitKey: "PIECE" }],
    });
    const thresholds = await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [
        { settingKey: "pricing.approval.discountPercentAbove", value: 10_000 },
        { settingKey: "pricing.approval.discountAmountAbove", value: 500 },
      ],
    });
    expect(thresholds.status).toBe(200);
    const overAmount = await world.alice.call("post", `/orgs/${world.organizationA}/quotes`, {
      locationId: world.locationA1,
      lines: [
        {
          offeringId: offering.offeringId,
          variantId: firstVariantId(offering),
          quantity: 1,
          manualDiscount: { type: "AMOUNT", value: 600 },
        },
      ],
    });
    expect(overAmount.status).toBe(200);
    expect(overAmount.body.data.approvalsRequired).toEqual([{ action: "DISCOUNT", lineIndex: 0 }]);

    const percentVersion =
      thresholds.body.data.settings["pricing.approval.discountPercentAbove"]?.version;
    const amountVersion =
      thresholds.body.data.settings["pricing.approval.discountAmountAbove"]?.version;
    const resetAmount = await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [
        {
          settingKey: "pricing.approval.discountPercentAbove",
          value: 10_000,
          version: percentVersion,
        },
        {
          settingKey: "pricing.approval.discountAmountAbove",
          value: 0,
          version: amountVersion,
        },
      ],
    });
    expect(resetAmount.status).toBe(200);
    expect(resetAmount.body.data.settings["pricing.approval.discountAmountAbove"]?.value).toBe(0);
    const amountOff = await world.alice.call("post", `/orgs/${world.organizationA}/quotes`, {
      locationId: world.locationA1,
      lines: [
        {
          offeringId: offering.offeringId,
          variantId: firstVariantId(offering),
          quantity: 1,
          manualDiscount: { type: "AMOUNT", value: 600 },
        },
      ],
    });
    expect(amountOff.status).toBe(200);
    expect(amountOff.body.data.approvalsRequired).toEqual([]);
  });

  it("answers 404 for a cross-org offering and 403 without permission", async () => {
    const world = await worldFor(harness, RETAIL, RETAIL);
    const offering = await publishOffering(world.alice, world.organizationA, {
      kind: "PRODUCT",
      name: "Tea",
      kindDetails: { requiresShipping: true },
      variants: [{ name: "Default", price: money(1000), unitKey: "PIECE" }],
    });
    const cross = await world.bob.call("post", `/orgs/${world.organizationB}/quotes`, {
      locationId: world.locationB1,
      lines: [
        {
          offeringId: offering.offeringId,
          variantId: firstVariantId(offering),
          quantity: 1,
        },
      ],
    });
    expect(cross.status).toBe(404);

    const rider = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.RIDER);
    const deniedPromotion = await rider.call("post", `/orgs/${world.organizationA}/promotions`, {
      name: "Nope",
      target: { scope: "ALL", ids: [] },
      benefit: { type: "PERCENT", value: 500 },
    });
    expect(deniedPromotion.status).toBe(403);

    const roleId = await createCustomRoleAs(world.alice, {
      organizationId: world.organizationA,
      name: "No catalog read",
      permissionKeys: [],
    });
    const noCatalog = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: ALL_LOCATIONS, roleId },
    ]);
    const deniedQuote = await noCatalog.actor.call("post", `/orgs/${world.organizationA}/quotes`, {
      locationId: world.locationA1,
      lines: [
        {
          offeringId: offering.offeringId,
          variantId: firstVariantId(offering),
          quantity: 1,
        },
      ],
    });
    expect(deniedQuote.status).toBe(403);
  });

  it("refuses an archived offering, an unavailable branch, a bad quantity and a missing modifier", async () => {
    const world = await worldFor(harness, RETAIL, RETAIL);
    const group = await world.alice.call("post", `/orgs/${world.organizationA}/modifier-groups`, {
      name: "Size",
      selection: "SINGLE",
      isRequired: true,
      minSelect: 1,
      maxSelect: 1,
      options: [
        { name: "Small", priceDelta: money(0) },
        { name: "Large", priceDelta: money(1000) },
      ],
    });
    expect(group.status).toBe(201);

    const offering = await publishOffering(world.alice, world.organizationA, {
      kind: "PRODUCT",
      name: "Shirt",
      kindDetails: { requiresShipping: true },
      modifierGroupIds: [group.body.data.modifierGroupId],
      variants: [
        {
          name: "Default",
          price: money(5000),
          unitKey: "KG",
          quantityRule: { min: 250, step: 250 },
        },
      ],
    });
    const variantId = firstVariantId(offering);
    const quotePath = `/orgs/${world.organizationA}/quotes`;
    const baseLine = { offeringId: offering.offeringId, variantId };

    const badQuantity = await world.alice.call("post", quotePath, {
      locationId: world.locationA1,
      lines: [{ ...baseLine, quantity: 100, modifierOptionIds: [] }],
    });
    expect(badQuantity.status).toBe(400);
    expect(badQuantity.body.error.details.fields[0].path).toBe("lines.0.quantity");

    const missingModifier = await world.alice.call("post", quotePath, {
      locationId: world.locationA1,
      lines: [{ ...baseLine, quantity: 250, modifierOptionIds: [] }],
    });
    expect(missingModifier.status).toBe(400);
    expect(missingModifier.body.error.details.fields[0].path).toBe("lines.0.modifierOptionIds");

    const unavailable = await world.alice.call(
      "put",
      offeringsPath(world.organizationA, `/${offering.offeringId}/locations/${world.locationA1}`),
      { isAvailable: false },
    );
    expect(unavailable.status).toBe(200);
    const optionId = group.body.data.options[0].modifierOptionId as string;
    const unavailableQuote = await world.alice.call("post", quotePath, {
      locationId: world.locationA1,
      lines: [{ ...baseLine, quantity: 250, modifierOptionIds: [optionId] }],
    });
    expect(unavailableQuote.status).toBe(422);
    expect(unavailableQuote.body.error.details.ruleKey).toBe("OFFERING_NOT_AVAILABLE");

    // Archive a second offering so the refusal is "not found", not the unavailable branch above.
    const other = await publishOffering(world.alice, world.organizationA, {
      kind: "PRODUCT",
      name: "Old shirt",
      kindDetails: { requiresShipping: true },
      variants: [{ name: "Default", price: money(2000), unitKey: "PIECE" }],
    });
    const archived = await world.alice.call(
      "post",
      offeringsPath(world.organizationA, `/${other.offeringId}/archive`),
      { version: other.version },
    );
    expect(archived.status).toBe(200);
    const archivedQuote = await world.alice.call("post", quotePath, {
      locationId: world.locationA1,
      lines: [{ offeringId: other.offeringId, variantId: firstVariantId(other), quantity: 1 }],
    });
    expect(archivedQuote.status).toBe(404);
  });
});

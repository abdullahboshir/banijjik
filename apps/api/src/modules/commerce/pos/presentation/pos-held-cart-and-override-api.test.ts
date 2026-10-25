import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { POS_HELD_CART_MAX_PER_DEVICE } from "@banijjik/contracts/pos";
import { INSTANT_ORDER_APPROVAL_SUBJECT } from "@banijjik/contracts/sales";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  memberWithRole,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  bdt,
  lineOf,
  openRegister,
  pairedTill,
  posPath,
  saleCall,
  stockedPack,
  tillCall,
  type Pack,
  type PosTill,
} from "../../../../test-support/pos-api-world.js";
import { setSetting, shopOf, type SalesShop } from "../../../../test-support/sales-api-world.js";
import type { ApiActor, TwoOrganizations } from "../../../../test-support/two-organizations.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const PRICE = 10_000;
const PIN = "4829";

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

interface Counter {
  readonly world: TwoOrganizations;
  readonly shop: SalesShop;
  readonly manager: ApiActor;
  readonly cashier: ApiActor;
  readonly till: PosTill;
  readonly pack: Pack;
}

async function aCounter(): Promise<Counter> {
  const world = await worldFor(harness, RETAIL);
  const shop = shopOf(world);
  const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
  const manager = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.MANAGER);
  const till = await pairedTill(harness.app, {
    manager: world.alice,
    cashier,
    organizationId: world.organizationA,
    locationId: world.locationA1,
  });
  await openRegister(till, 5_000);
  const pack = await stockedPack(shop, { packs: 10, priceAmount: PRICE });
  return { world, shop, manager, cashier, till, pack };
}

async function issuePriceOverrideToken(
  owner: ApiActor,
  requester: ApiActor,
  input: { readonly organizationId: string; readonly locationId: string; readonly amount: number },
): Promise<string> {
  const setPin = await owner.call("put", `/orgs/${input.organizationId}/me/approval-pin`, {
    pin: PIN,
    currentPassword: owner.person.password,
  });
  expect(setPin.status, JSON.stringify(setPin.body)).toBe(204);
  const approvers = await owner.call(
    "get",
    `/orgs/${input.organizationId}/approvers?locationId=${input.locationId}`,
  );
  const approverMemberId = approvers.body.data[0]?.memberId as string;
  const granted = await requester.call("post", `/orgs/${input.organizationId}/approvals`, {
    action: "PRICE_OVERRIDE",
    subjectKey: INSTANT_ORDER_APPROVAL_SUBJECT,
    locationId: input.locationId,
    approverMemberId,
    pin: PIN,
    amount: bdt(input.amount),
  });
  expect(granted.status, JSON.stringify(granted.body)).toBe(200);
  return granted.body.data.approvalToken as string;
}

describe("POS held carts", () => {
  it("a held cart is stored without prices, listed on its device only, and refused past 20", async () => {
    const { world, till, pack, cashier } = await aCounter();
    const otherTill = await pairedTill(harness.app, {
      manager: world.alice,
      cashier,
      organizationId: world.organizationA,
      locationId: world.locationA1,
      name: "Counter 2",
    });

    const created = await tillCall(till, {
      method: "post",
      suffix: "/held-carts",
      body: {
        label: "Customer stepped out",
        cart: { lines: [lineOf(pack, 2)], note: "Hold at counter" },
      },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const heldId = created.body.data.posHeldCartId as string;
    expect(created.body.data.cart.lines[0]).toEqual({
      offeringId: pack.offeringId,
      variantId: pack.variantId,
      quantity: 2,
      modifierOptionIds: [],
    });
    expect(JSON.stringify(created.body.data.cart)).not.toContain("price");

    for (let index = 1; index < POS_HELD_CART_MAX_PER_DEVICE; index += 1) {
      const more = await tillCall(till, {
        method: "post",
        suffix: "/held-carts",
        body: { label: `Cart ${index + 1}`, cart: { lines: [lineOf(pack)] } },
      });
      expect(more.status).toBe(201);
    }
    const twentyFirst = await tillCall(till, {
      method: "post",
      suffix: "/held-carts",
      body: { label: "Cart 21", cart: { lines: [lineOf(pack)] } },
    });
    expect(twentyFirst.status).toBe(422);
    expect(twentyFirst.body.error.details.ruleKey).toBe("POS_HELD_CART_LIMIT");

    const onThisDevice = await tillCall(till, { method: "get", suffix: "/held-carts" });
    const onOtherDevice = await tillCall(otherTill, { method: "get", suffix: "/held-carts" });
    const deleteFromOtherDevice = await tillCall(otherTill, {
      method: "delete",
      suffix: `/held-carts/${heldId}`,
    });
    const crossOrgDelete = await world.bob.call(
      "delete",
      posPath(world.organizationB, `/held-carts/${heldId}`),
    );
    const deleteOwn = await tillCall(till, {
      method: "delete",
      suffix: `/held-carts/${heldId}?version=1`,
    });

    expect(onThisDevice.body.data).toHaveLength(POS_HELD_CART_MAX_PER_DEVICE);
    expect(onOtherDevice.body.data).toEqual([]);
    expect(deleteFromOtherDevice.status).toBe(404);
    expect(crossOrgDelete.status).toBe(403);
    expect(deleteOwn.status).toBe(204);
  });

  it("a held cart expires after 24 hours", async () => {
    const { till, pack } = await aCounter();
    const created = await tillCall(till, {
      method: "post",
      suffix: "/held-carts",
      body: { label: "Wait 24h", cart: { lines: [lineOf(pack)] } },
    });
    const heldId = created.body.data.posHeldCartId as string;
    const ttlDeltaMs =
      new Date(created.body.data.expiresAt as string).getTime() -
      new Date(created.body.data.createdAt as string).getTime();
    expect(ttlDeltaMs).toBe(24 * 3_600_000);

    const indexes = await harness.connections.tenantShared.collection("pos_held_carts").indexes();
    expect(
      indexes.some((idx) => idx["key"]?.["expiresAt"] === 1 && idx["expireAfterSeconds"] === 0),
    ).toBe(true);

    await harness.connections.tenantShared
      .collection("pos_held_carts")
      .updateOne({ posHeldCartId: heldId }, { $set: { expiresAt: new Date(0) } });

    const listed = await tillCall(till, { method: "get", suffix: "/held-carts" });
    const deleted = await tillCall(till, { method: "delete", suffix: `/held-carts/${heldId}` });
    expect(listed.body.data).toEqual([]);
    expect(deleted.status).toBe(404);
  });
});

describe("POS price override and access", () => {
  it("a price override below the list price needs pos.priceOverride and a PRICE_OVERRIDE approval for the difference", async () => {
    const { world, manager, till, pack } = await aCounter();
    const overriddenLine = { ...lineOf(pack, 2), unitPriceOverride: bdt(8_000) };

    const byCashier = await saleCall(till, {
      lines: [overriddenLine],
      payments: [{ method: "CASH", amount: bdt(16_000) }],
    });
    expect(byCashier.status).toBe(403);
    expect(byCashier.body.error.code).toBe("FORBIDDEN");

    const withoutToken = await tillCall(till, {
      method: "post",
      suffix: "/sales",
      as: manager,
      body: {
        lines: [overriddenLine],
        payments: [{ method: "CASH", amount: bdt(16_000) }],
      },
    });
    expect(withoutToken.status).toBe(403);
    expect(withoutToken.body.error.code).toBe("APPROVAL_REQUIRED");
    expect(withoutToken.body.error.details.action).toBe("PRICE_OVERRIDE");

    const token = await issuePriceOverrideToken(world.alice, manager, {
      organizationId: world.organizationA,
      locationId: world.locationA1,
      amount: (PRICE - 8_000) * 2,
    });
    const approved = await tillCall(till, {
      method: "post",
      suffix: "/sales",
      as: manager,
      body: {
        lines: [overriddenLine],
        payments: [{ method: "CASH", amount: bdt(16_000) }],
        approvalToken: token,
      },
    });
    expect(approved.status, JSON.stringify(approved.body)).toBe(201);
    expect(approved.body.data.order.totals.grandTotal).toEqual(bdt(16_000));
    expect(approved.body.data.order.lines[0]).toMatchObject({
      listUnitPrice: bdt(PRICE),
      unitPriceOverride: bdt(8_000),
      unitPrice: bdt(8_000),
    });
  });

  it("an override above the list price needs the permission only", async () => {
    const { manager, till, pack } = await aCounter();

    const response = await tillCall(till, {
      method: "post",
      suffix: "/sales",
      as: manager,
      body: {
        lines: [{ ...lineOf(pack), unitPriceOverride: bdt(12_000) }],
        payments: [{ method: "CASH", amount: bdt(12_000) }],
      },
    });

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.data.order.totals.grandTotal).toEqual(bdt(12_000));
    expect(response.body.data.order.lines[0]).toMatchObject({
      listUnitPrice: bdt(PRICE),
      unitPriceOverride: bdt(12_000),
      unitPrice: bdt(12_000),
    });
  });

  it("discount and tax are computed on the overridden price", async () => {
    const { world, shop, manager, till, pack } = await aCounter();
    const createTax = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/tax-classes`,
      idempotencyKey: "019a0000-0000-7000-8000-000000000099",
      body: {
        taxClassKey: "vat-15",
        name: "VAT 15%",
        rateBasisPoints: 1_500,
      },
    });
    expect(createTax.status, JSON.stringify(createTax.body)).toBe(201);
    await setSetting(shop, "pricing.taxInclusive", false);
    await setSetting(shop, "pricing.defaultTaxClassKey", "vat-15");
    const token = await issuePriceOverrideToken(world.alice, manager, {
      organizationId: world.organizationA,
      locationId: world.locationA1,
      amount: 2_000,
    });

    const response = await tillCall(till, {
      method: "post",
      suffix: "/sales",
      as: manager,
      body: {
        lines: [
          {
            ...lineOf(pack),
            unitPriceOverride: bdt(8_000),
            manualDiscount: { type: "PERCENT", value: 500 },
          },
        ],
        payments: [{ method: "CASH", amount: bdt(8_740) }],
        approvalToken: token,
      },
    });

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.data.order.totals).toMatchObject({
      subtotal: bdt(8_000),
      discountTotal: bdt(400),
      taxTotal: bdt(1_140),
      grandTotal: bdt(8_740),
    });
  });

  it("a staff member without pos.sale.create gets 403", async () => {
    const { world, till, pack } = await aCounter();
    const hold = await tillCall(till, {
      method: "post",
      suffix: "/held-carts",
      as: world.sam,
      body: { label: "Staff", cart: { lines: [lineOf(pack)] } },
    });
    expect(hold.status).toBe(403);
  });
});

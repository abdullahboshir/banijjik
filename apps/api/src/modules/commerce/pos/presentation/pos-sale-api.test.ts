import { AUDIT_ACTION, IDEMPOTENCY_REPLAYED_HEADER, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { asId, newId, type ContactId, type OrganizationId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  memberWithRole,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { countAuditRows } from "../../../../test-support/organization-tenant-world.js";
import { withOrganizationContext } from "../../../../test-support/organization-context.js";
import {
  bdt,
  lineOf,
  openRegister,
  pairedTill,
  saleCall,
  stockedPack,
  tillCall,
  GRAMS_PER_PACK,
  type Pack,
  type PosTill,
  type SaleRow,
  type SessionRow,
} from "../../../../test-support/pos-api-world.js";
import {
  addCustomer,
  levelOf,
  listOrders,
  movementsOf,
  setSetting,
  shopOf,
  type SalesShop,
} from "../../../../test-support/sales-api-world.js";
import { MongoContactStoreCreditAdapter } from "../../payment/index.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const PRICE = 10_000;
const PACKS_ON_SHELF = 3;
const CUSTOMER_PHONE = "+8801700000042";

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

interface Counter {
  readonly shop: SalesShop;
  readonly till: PosTill;
  readonly pack: Pack;
  readonly session: SessionRow;
}

/** A shop with a stocked product, a paired till and an open register holding a float. */
async function aCounter(): Promise<Counter> {
  const world = await worldFor(harness, RETAIL);
  const shop = shopOf(world);
  const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
  const till = await pairedTill(harness.app, {
    manager: world.alice,
    cashier,
    organizationId: world.organizationA,
    locationId: world.locationA1,
  });
  const pack = await stockedPack(shop, { packs: PACKS_ON_SHELF, priceAmount: PRICE });
  return { shop, till, pack, session: await openRegister(till, 5_000) };
}

function cashSale(pack: Pack, extra: object = {}): object {
  return { lines: [lineOf(pack)], payments: [{ method: "CASH", amount: bdt(PRICE) }], ...extra };
}

function paymentsOfOrganization(organizationId: string, filter: object = {}) {
  return harness.connections.tenantShared
    .collection("payments")
    .find({ organizationId, ...filter })
    .toArray();
}

async function onHandOf(counter: Counter): Promise<number> {
  return (await levelOf(counter.shop, counter.pack.inventoryItemId)).onHand;
}

describe("POS sale", () => {
  it("a POS sale completes the order, takes stock, records each payment with the session and returns change, in one transaction", async () => {
    const counter = await aCounter();
    const { shop, till, pack, session } = counter;

    const response = await saleCall(till, {
      lines: [lineOf(pack)],
      payments: [
        { method: "CARD", amount: bdt(4_000) },
        { method: "CASH", amount: bdt(6_000) },
      ],
      cashTendered: bdt(10_000),
    });

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    const sale = response.body.data as SaleRow;
    expect(sale.order).toMatchObject({
      status: "COMPLETED",
      source: "POS",
      paymentStatus: "PAID",
    });
    expect(sale.order.totals.grandTotal.amount).toBe(PRICE);
    expect(sale.posSessionId).toBe(session.posSessionId);
    expect(sale.payments.map((payment) => [payment.method, payment.amount.amount])).toEqual([
      ["CARD", 4_000],
      ["CASH", 6_000],
    ]);
    expect(sale.changeDue.amount).toBe(4_000);
    expect(sale.dueAmount.amount).toBe(0);
    expect(await onHandOf(counter)).toBe((PACKS_ON_SHELF - 1) * GRAMS_PER_PACK);
    // The sale touched the register, which is what makes a racing close conflict with it.
    const registerRow = await harness.connections.tenantShared
      .collection("pos_sessions")
      .findOne({ posSessionId: session.posSessionId });
    expect(registerRow?.["lastSaleAt"]).not.toBeNull();
    const rows = await paymentsOfOrganization(shop.organizationId, {
      posSessionId: session.posSessionId,
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row["amount"].amount).sort()).toEqual([4_000, 6_000]);
    expect(
      await countAuditRows(harness.connections, {
        organizationId: shop.organizationId,
        action: AUDIT_ACTION.POS_SALE_CREATED,
        entityId: sale.order.orderId,
      }),
    ).toBe(1);
  });

  it("a failure in the payment step leaves no order, no stock movement and no payment", async () => {
    const counter = await aCounter();
    const { shop, till, pack } = counter;
    const movementsBefore = (await movementsOf(shop)).length;

    // The cash payment succeeds first; the bKash one has no reference and fails, so both must roll back.
    const response = await saleCall(till, {
      lines: [lineOf(pack)],
      payments: [
        { method: "CASH", amount: bdt(5_000) },
        { method: "BKASH", amount: bdt(5_000) },
      ],
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await listOrders(shop)).toHaveLength(0);
    expect(await onHandOf(counter)).toBe(PACKS_ON_SHELF * GRAMS_PER_PACK);
    expect((await movementsOf(shop)).length).toBe(movementsBefore);
    expect(await paymentsOfOrganization(shop.organizationId)).toHaveLength(0);
  });

  it("the same Idempotency-Key returns the first sale and charges nothing twice", async () => {
    const counter = await aCounter();
    const { shop, till, pack } = counter;
    const key = newId();

    const first = await saleCall(till, cashSale(pack), key);
    const second = await saleCall(till, cashSale(pack), key);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.headers[IDEMPOTENCY_REPLAYED_HEADER.toLowerCase()]).toBe("true");
    expect(second.body.data.order.orderId).toBe(first.body.data.order.orderId);
    expect(await listOrders(shop)).toHaveLength(1);
    expect(await paymentsOfOrganization(shop.organizationId)).toHaveLength(1);
    expect(await onHandOf(counter)).toBe((PACKS_ON_SHELF - 1) * GRAMS_PER_PACK);
  });

  it("refuses a sale without an Idempotency-Key", async () => {
    const { till, pack } = await aCounter();

    const response = await tillCall(till, {
      method: "post",
      suffix: "/sales",
      body: cashSale(pack),
      idempotencyKey: null,
    });

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).toContain("validation.idempotency_key_required");
  });

  it("a non-cash overpayment is a 422 and a cash tender below the cash part too", async () => {
    const { shop, till, pack } = await aCounter();

    const over = await saleCall(till, {
      lines: [lineOf(pack)],
      payments: [{ method: "CARD", amount: bdt(PRICE + 500) }],
    });
    const below = await saleCall(till, {
      lines: [lineOf(pack)],
      payments: [{ method: "CASH", amount: bdt(PRICE) }],
      cashTendered: bdt(PRICE - 1),
    });

    expect(over.status).toBe(422);
    expect(over.body.error.details.ruleKey).toBe("POS_OVERPAYMENT_NOT_CASH");
    expect(below.status).toBe(422);
    expect(below.body.error.details.ruleKey).toBe("POS_CASH_TENDERED_INVALID");
    expect(await listOrders(shop)).toHaveLength(0);
  });
});

describe("POS sale register rules", () => {
  it("a sale without an open register is 409 when a shift is required", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
    const till = await pairedTill(harness.app, {
      manager: world.alice,
      cashier,
      organizationId: world.organizationA,
      locationId: world.locationA1,
    });
    const pack = await stockedPack(shop, { packs: 1, priceAmount: PRICE });

    const response = await saleCall(till, cashSale(pack));

    expect(response.status).toBe(409);
    expect(response.body.error.messageKey).toBe("errors.pos_session_required");
    expect(await listOrders(shop)).toHaveLength(0);
  });

  it("sells without a register when the shift is not required, and the payments carry no session", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
    const till = await pairedTill(harness.app, {
      manager: world.alice,
      cashier,
      organizationId: world.organizationA,
      locationId: world.locationA1,
    });
    await setSetting(shop, "pos.requireShift", false);
    const pack = await stockedPack(shop, { packs: 1, priceAmount: PRICE });

    const response = await saleCall(till, cashSale(pack));

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.data.posSessionId).toBeNull();
    const rows = await paymentsOfOrganization(shop.organizationId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.["posSessionId"]).toBeNull();
  });

  it("prints the receipt footer setting of the location", async () => {
    const { shop, till, pack } = await aCounter();
    await setSetting(shop, "pos.receiptFooter", "Thank you, come again");

    const response = await saleCall(till, cashSale(pack));

    expect(response.body.data.receiptFooter).toBe("Thank you, come again");
  });
});

describe("POS sale store credit and dues", () => {
  async function creditOf(counter: Counter, contactId: string, amount: number): Promise<void> {
    const organizationId = asId<OrganizationId>(counter.shop.organizationId);
    const adapter = new MongoContactStoreCreditAdapter();
    await withOrganizationContext(counter.shop.organizationId, async () => {
      const balance = await adapter.getBalance(organizationId, asId<ContactId>(contactId));
      const done = await adapter.adjustBalance({
        organizationId,
        contactId: asId<ContactId>(contactId),
        deltaMinor: amount,
        expectedVersion: balance?.version ?? 1,
      });
      expect(done.success).toBe(true);
    });
  }

  async function balanceOf(counter: Counter, contactId: string): Promise<number> {
    const response = await counter.shop.actor.call(
      "get",
      `/orgs/${counter.shop.organizationId}/contacts/${contactId}`,
    );
    return response.body.data.summary?.storeCreditBalanceMinor ?? 0;
  }

  it("store credit is used first and never goes below zero", async () => {
    const counter = await aCounter();
    const contactId = await addCustomer(counter.shop, "Rahim", CUSTOMER_PHONE);
    await creditOf(counter, contactId, 3_000);

    const tooMuch = await saleCall(counter.till, {
      lines: [lineOf(counter.pack)],
      contactId,
      storeCreditUse: bdt(5_000),
      payments: [{ method: "CASH", amount: bdt(5_000) }],
    });
    const response = await saleCall(counter.till, {
      lines: [lineOf(counter.pack)],
      contactId,
      storeCreditUse: bdt(3_000),
      payments: [{ method: "CASH", amount: bdt(7_000) }],
    });

    expect(tooMuch.status).toBeGreaterThanOrEqual(400);
    expect(await balanceOf(counter, contactId)).toBe(0);
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    const sale = response.body.data as SaleRow;
    expect(sale.payments.map((payment) => payment.method)).toEqual(["STORE_CREDIT", "CASH"]);
    expect(sale.storeCreditUsed.amount).toBe(3_000);
    expect(sale.order.paymentStatus).toBe("PAID");
    expect(await listOrders(counter.shop)).toHaveLength(1);
  });

  it("refuses store credit without a customer and leaves nothing written", async () => {
    const counter = await aCounter();

    const response = await saleCall(counter.till, {
      lines: [lineOf(counter.pack)],
      storeCreditUse: bdt(1_000),
      payments: [{ method: "CASH", amount: bdt(9_000) }],
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await listOrders(counter.shop)).toHaveLength(0);
    expect(await onHandOf(counter)).toBe(PACKS_ON_SHELF * GRAMS_PER_PACK);
  });

  it("a short payment is a due only with credit sale on and a contact; otherwise 422", async () => {
    // The RETAIL template turns credit sales on, so the default shop is the "on" case.
    const on = await aCounter();
    const contactId = await addCustomer(on.shop, "Karim", "+8801700000043");
    const half = { lines: [lineOf(on.pack)], payments: [{ method: "CASH", amount: bdt(6_000) }] };
    const off = await aCounter();
    await setSetting(off.shop, "pos.allowCreditSale", false);
    const offContactId = await addCustomer(off.shop, "Salma", "+8801700000044");

    const noContact = await saleCall(on.till, half);
    const credit = await saleCall(on.till, { ...half, contactId });
    const switchedOff = await saleCall(off.till, {
      lines: [lineOf(off.pack)],
      payments: half.payments,
      contactId: offContactId,
    });

    expect(noContact.status).toBe(422);
    expect(noContact.body.error.details.ruleKey).toBe("POS_PAYMENT_SHORT");
    expect(switchedOff.status).toBe(422);
    expect(switchedOff.body.error.details.ruleKey).toBe("POS_PAYMENT_SHORT");
    expect(credit.status, JSON.stringify(credit.body)).toBe(201);
    expect(credit.body.data.dueAmount.amount).toBe(4_000);
    expect(credit.body.data.order.paymentStatus).toBe("PARTIAL");
    expect(await listOrders(on.shop)).toHaveLength(1);
    expect(await listOrders(off.shop)).toHaveLength(0);
  });
});

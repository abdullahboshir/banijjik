import { AUDIT_ACTION, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { POS_EVENT_TYPE } from "@banijjik/contracts/pos";
import { asId, newId, type ContactId, type OrganizationId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  memberWithRole,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  countAuditRows,
  countOutboxRows,
} from "../../../../test-support/organization-tenant-world.js";
import { withOrganizationContext } from "../../../../test-support/organization-context.js";
import {
  bdt,
  closeRegister,
  lineOf,
  openRegister,
  pairedTill,
  saleCall,
  stockedPack,
  tillCall,
  type Pack,
  type PosTill,
} from "../../../../test-support/pos-api-world.js";
import {
  addCustomer,
  listOrders,
  shopOf,
  type SalesShop,
} from "../../../../test-support/sales-api-world.js";
import type { ApiActor } from "../../../../test-support/two-organizations.js";
import { MongoContactStoreCreditAdapter } from "../../payment/index.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const PRICE = 10_000;
const FLOAT = 5_000;

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

interface Counter {
  readonly shop: SalesShop;
  readonly manager: ApiActor;
  readonly till: PosTill;
  readonly pack: Pack;
  readonly staff: ApiActor;
}

async function aCounter(packs = 10): Promise<Counter> {
  const world = await worldFor(harness, RETAIL);
  const shop = shopOf(world);
  const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
  const till = await pairedTill(harness.app, {
    manager: world.alice,
    cashier,
    organizationId: world.organizationA,
    locationId: world.locationA1,
  });
  const pack = await stockedPack(shop, { packs, priceAmount: PRICE });
  return { shop, manager: world.alice, till, pack, staff: world.sam };
}

function sale(pack: Pack, payments: object[], extra: object = {}): object {
  return { lines: [lineOf(pack)], payments, ...extra };
}

describe("POS register", () => {
  it("a second register open on the same device is 409", async () => {
    const { till } = await aCounter();
    const first = await openRegister(till, FLOAT);

    const second = await tillCall(till, {
      method: "post",
      suffix: "/sessions",
      body: { openingFloat: bdt(0) },
    });

    expect(second.status).toBe(409);
    expect(second.body.error.messageKey).toBe("errors.pos_session_already_open");
    expect(second.body.error.details.posSessionId).toBe(first.posSessionId);
  });

  it("two registers opened at once on one device leave exactly one open", async () => {
    const { till } = await aCounter();

    const answers = await Promise.all(
      [1, 2, 3].map(() =>
        tillCall(till, { method: "post", suffix: "/sessions", body: { openingFloat: bdt(0) } }),
      ),
    );

    expect(answers.filter((answer) => answer.status === 201)).toHaveLength(1);
    expect(answers.filter((answer) => answer.status === 409).length).toBe(2);
  });

  it("closing computes expected cash, stores the variance and a gapless Z-report number", async () => {
    const { shop, till, pack } = await aCounter();
    const session = await openRegister(till, FLOAT);
    await saleCall(till, sale(pack, [{ method: "CASH", amount: bdt(PRICE) }]));
    await saleCall(till, sale(pack, [{ method: "CARD", amount: bdt(PRICE) }]));

    const stale = await closeRegister(till, {
      session: { ...session, version: session.version + 3 },
      countedCash: 14_000,
    });
    const closed = await closeRegister(till, { session, countedCash: 14_000 });
    const again = await closeRegister(till, { session, countedCash: 14_000 });
    const second = await openRegister(till, 0);
    const closedSecond = await closeRegister(till, { session: second, countedCash: 0 });

    expect(stale.status).toBe(409);
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    expect(closed.body.data).toMatchObject({
      status: "CLOSED",
      expectedCash: bdt(FLOAT + PRICE),
      countedCash: bdt(14_000),
      variance: bdt(-1_000),
      zReportNumber: "000001",
    });
    expect(again.status).toBe(409);
    expect(again.body.error.messageKey).toBe("errors.pos_session_closed");
    expect(closedSecond.body.data.zReportNumber).toBe("000002");
    expect(
      await countAuditRows(harness.connections, {
        organizationId: shop.organizationId,
        action: AUDIT_ACTION.POS_SESSION_CLOSED,
      }),
    ).toBe(2);
    expect(
      await countOutboxRows(harness.connections, {
        organizationId: shop.organizationId,
        type: POS_EVENT_TYPE.REGISTER_CLOSED,
      }),
    ).toBe(2);
  });

  it("lets a manager close another member's register but not another cashier", async () => {
    const world = await worldFor(harness, RETAIL);
    const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
    const otherCashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
    const till = await pairedTill(harness.app, {
      manager: world.alice,
      cashier,
      organizationId: world.organizationA,
      locationId: world.locationA1,
    });
    const session = await openRegister(till, 0);

    const byOther = await closeRegister(till, { session, countedCash: 0, as: otherCashier });
    const byManager = await closeRegister(till, { session, countedCash: 0, as: world.alice });

    expect(byOther.status).toBe(403);
    expect(byManager.status, JSON.stringify(byManager.body)).toBe(200);
  });
});

describe("POS Z-report", () => {
  async function creditOf(shop: SalesShop, contactId: string, amount: number): Promise<void> {
    const organizationId = asId<OrganizationId>(shop.organizationId);
    const adapter = new MongoContactStoreCreditAdapter();
    await withOrganizationContext(shop.organizationId, async () => {
      const balance = await adapter.getBalance(organizationId, asId<ContactId>(contactId));
      await adapter.adjustBalance({
        organizationId,
        contactId: asId<ContactId>(contactId),
        deltaMinor: amount,
        expectedVersion: balance?.version ?? 1,
      });
    });
  }

  it("the Z-report shows totals per method, refunds, credit used and dues created", async () => {
    const { shop, till, pack, staff, manager } = await aCounter();
    const session = await openRegister(till, FLOAT);
    const contactId = await addCustomer(shop, "Rahim", "+8801700000051");
    await creditOf(shop, contactId, 3_000);
    await saleCall(
      till,
      sale(
        pack,
        [
          { method: "CARD", amount: bdt(4_000) },
          { method: "CASH", amount: bdt(6_000) },
        ],
        { cashTendered: bdt(10_000) },
      ),
    );
    await saleCall(
      till,
      sale(pack, [{ method: "CASH", amount: bdt(7_000) }], {
        contactId,
        storeCreditUse: bdt(3_000),
      }),
    );
    await saleCall(till, sale(pack, [{ method: "CASH", amount: bdt(6_000) }], { contactId }));
    // A cash refund at the till arrives with a later card; the report must already net it from the drawer.
    await harness.connections.tenantShared.collection("payments").insertOne({
      paymentId: newId(),
      organizationId: shop.organizationId,
      locationId: till.locationId,
      paymentNumber: "REFUND-TEST",
      direction: "REFUND",
      method: "CASH",
      amount: bdt(2_000),
      allocations: [],
      posSessionId: session.posSessionId,
    });

    const closed = await closeRegister(till, { session, countedCash: 22_000 });
    const report = await tillCall(till, {
      method: "get",
      suffix: `/sessions/${session.posSessionId}/z-report`,
    });
    const byManager = await tillCall(till, {
      method: "get",
      suffix: `/sessions/${session.posSessionId}/z-report`,
      as: manager,
    });
    const bySam = await tillCall(till, {
      method: "get",
      suffix: `/sessions/${session.posSessionId}/z-report`,
      as: staff,
    });

    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    expect(report.status).toBe(200);
    expect(report.body.data).toMatchObject({
      zReportNumber: "000001",
      salesCount: 3,
      grandTotal: bdt(3 * PRICE),
      storeCreditUsed: bdt(3_000),
      duesCreated: bdt(4_000),
      openingFloat: bdt(FLOAT),
      expectedCash: bdt(FLOAT + 6_000 + 7_000 + 6_000 - 2_000),
      countedCash: bdt(22_000),
      variance: bdt(0),
    });
    expect(
      report.body.data.paymentsIn.map(
        (entry: { method: string; total: { amount: number }; count: number }) => [
          entry.method,
          entry.total.amount,
          entry.count,
        ],
      ),
    ).toEqual([
      ["CASH", 19_000, 3],
      ["CARD", 4_000, 1],
    ]);
    expect(
      report.body.data.refunds.map((entry: { method: string; total: { amount: number } }) => [
        entry.method,
        entry.total.amount,
      ]),
    ).toEqual([["CASH", 2_000]]);
    expect(byManager.status).toBe(200);
    expect(byManager.body.data).toEqual(report.body.data);
    expect(bySam.status).toBe(403);
    expect(await listOrders(shop)).toHaveLength(3);
  });

  it("the Z-report counts a credit sale with no payment", async () => {
    const { shop, till, pack } = await aCounter();
    const session = await openRegister(till, FLOAT);
    const contactId = await addCustomer(shop, "Rahim", "+8801700000053");

    const creditSale = await saleCall(till, sale(pack, [], { contactId }));
    const closed = await closeRegister(till, { session, countedCash: FLOAT });
    const report = await tillCall(till, {
      method: "get",
      suffix: `/sessions/${session.posSessionId}/z-report`,
    });
    const storedOrder = await harness.connections.tenantShared
      .collection("orders")
      .findOne({ orderId: creditSale.body.data.order.orderId });

    expect(creditSale.status, JSON.stringify(creditSale.body)).toBe(201);
    expect(creditSale.body.data.posSessionId).toBe(session.posSessionId);
    expect(creditSale.body.data.dueAmount).toEqual(bdt(PRICE));
    expect(storedOrder?.posSessionId).toBe(session.posSessionId);
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    expect(report.body.data).toMatchObject({
      salesCount: 1,
      grandTotal: bdt(PRICE),
      duesCreated: bdt(PRICE),
      paymentsIn: [],
      expectedCash: bdt(FLOAT),
      variance: bdt(0),
    });
  });

  it("has no report while the register is still open", async () => {
    const { till } = await aCounter();
    const session = await openRegister(till, 0);

    const report = await tillCall(till, {
      method: "get",
      suffix: `/sessions/${session.posSessionId}/z-report`,
    });

    expect(report.status).toBe(404);
  });
});

describe("POS sale racing the close", () => {
  it("a sale racing the close either lands in the closed report or is refused, never lost", async () => {
    const { shop, till, pack } = await aCounter(20);

    for (let round = 0; round < 6; round += 1) {
      const session = await openRegister(till, 0);
      const [saleAnswer, closeAnswer] = await Promise.all([
        saleCall(till, sale(pack, [{ method: "CASH", amount: bdt(PRICE) }])),
        closeRegister(till, { session, countedCash: 0 }),
      ]);
      const report = await tillCall(till, {
        method: "get",
        suffix: `/sessions/${session.posSessionId}/z-report`,
      });

      expect(closeAnswer.status, JSON.stringify(closeAnswer.body)).toBe(200);
      const inReport = report.body.data.salesCount as number;
      if (saleAnswer.status === 201) {
        expect(inReport, `round ${round}`).toBe(1);
        expect(report.body.data.expectedCash).toEqual(bdt(PRICE));
      } else {
        expect(saleAnswer.status, JSON.stringify(saleAnswer.body)).toBe(409);
        expect(saleAnswer.body.error.messageKey).toBe("errors.pos_session_required");
        expect(inReport, `round ${round}`).toBe(0);
      }
    }
    const payments = await harness.connections.tenantShared
      .collection("payments")
      .countDocuments({ organizationId: shop.organizationId });
    const reported = await harness.connections.tenantShared
      .collection("pos_sessions")
      .find({ organizationId: shop.organizationId })
      .toArray();
    const reportedSales = reported.reduce(
      (sum, row) => sum + ((row["zReport"] as { salesCount: number }).salesCount ?? 0),
      0,
    );
    expect(payments).toBe(reportedSales);
    expect((await listOrders(shop)).length).toBe(reportedSales);
  });
});

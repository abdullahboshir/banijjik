import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MODULE_KEY, MODULE_OVERRIDE_EFFECT } from "@banijjik/contracts";
import { POSTING_KEY, SYSTEM_ACCOUNT_CODE } from "@banijjik/contracts/accounting";
import {
  COMMISSION_CALCULATION,
  COMMISSION_SUBJECT_TYPE,
  COMMISSION_TARGET_TYPE,
} from "@banijjik/contracts/commission";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import {
  instantOrder,
  movementsOf,
  publishOffering,
  shopOf,
  type SalesShop,
} from "../../../../test-support/sales-api-world.js";
import {
  newContact,
  payOrder,
  postReturn,
  returnBody,
} from "../../../../test-support/sales-return-world.js";
import { exchangeBody, postExchange } from "../../../../test-support/sales-exchange-world.js";
import { writeModuleOverride } from "../../../../test-support/entitlement-world.js";
import { processOrganizationOutbox } from "../../../../test-support/outbox-replay.js";
import { withOrganizationContext } from "../../../../test-support/organization-context.js";
import { registerAccountingAndExpenseHandlers } from "../../../../routes/accounting-event-handlers.js";
import { registerCommissionHandlers } from "../../../../routes/commission-adapters.js";
import { buildModuleRegistry } from "../../../../routes/module-registry.js";
import {
  buildOrganizationConfigPorts,
  buildResolvedConfigSources,
} from "../../../../routes/organization-config-ports.js";
import { buildOrgConfigService } from "../../../platform/entitlement/index.js";
import { buildIndustryTemplateReader } from "../../../platform/industry/index.js";
import { systemClock } from "../../../../kernel/time/index.js";
import { MongoJournalRepository } from "../../accounting/index.js";

registerIamApiModels();
const RETAIL = { industryTemplateKey: "RETAIL" };
const SALON = { industryTemplateKey: "SALON" };
let harness: IamApiHarness;
beforeAll(async () => {
  harness = await startCatalogApi();
  registerAccountingAndExpenseHandlers();
  const registry = buildModuleRegistry();
  const orgConfig = buildOrgConfigService({
    registry,
    clock: systemClock,
    ...buildOrganizationConfigPorts(),
    ...buildResolvedConfigSources(registry),
    templates: buildIndustryTemplateReader(systemClock),
  });
  registerCommissionHandlers(systemClock, orgConfig);
});
afterAll(async () => {
  await harness.dispose();
});

async function serviceOf(shop: SalesShop) {
  return publishOffering(shop, {
    kind: "SERVICE",
    name: "Walk-in service",
    priceAmount: 1000,
    kindDetails: { durationMinutes: 30, bookingMode: "WALK_IN_ONLY" },
  });
}
async function journalsOf(shop: SalesShop, sourceId: string) {
  return withOrganizationContext(shop.organizationId, async () => {
    const page = await new MongoJournalRepository().list({ page: 1, limit: 100 });
    return page.items.filter((entry) => entry.sourceId === sourceId);
  });
}
async function commissionAmounts(shop: SalesShop, orderId: string): Promise<number[]> {
  const response = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/commission/entries?limit=100`,
  );
  expect(response.status).toBe(200);
  const entries = response.body.data as { sourceId: string; amount: { amount: number } }[];
  return entries
    .filter((entry) => entry.sourceId === orderId)
    .map((entry) => entry.amount.amount)
    .sort((left, right) => left - right);
}
async function paidService(shop: SalesShop) {
  const service = await serviceOf(shop);
  const contactId = await newContact(shop);
  const sold = await instantOrder(shop, {
    locationId: shop.locationId,
    contactId,
    lines: [{ ...service, quantity: 1 }],
  });
  expect(sold.status).toBe(201);
  expect((await payOrder(shop, sold.order.orderId, { amount: 1000 })).status).toBe(201);
  const line = sold.order.lines[0];
  if (line === undefined) throw new Error("expected service line");
  return { order: sold.order, line, service };
}

describe("walk-in service money flows", () => {
  it("the completed walk-in sale posts service revenue to REVENUE_SERVICE and product revenue to REVENUE_PRODUCT", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL, SALON));
    const service = await serviceOf(shop);
    const product = await publishOffering(shop, {
      kind: "PRODUCT",
      name: "Comb",
      priceAmount: 500,
    });
    const sold = await instantOrder(shop, {
      locationId: shop.locationId,
      lines: [
        { ...service, quantity: 1 },
        { ...product, quantity: 1 },
      ],
    });
    expect(sold.status).toBe(201);
    await processOrganizationOutbox(shop.organizationId);
    await processOrganizationOutbox(shop.organizationId);
    const entries = await journalsOf(shop, sold.order.orderId);
    const revenue = entries.filter((entry) => entry.postingKey === POSTING_KEY.order_revenue);
    expect(revenue).toHaveLength(1);
    const lines = revenue[0]?.lines ?? [];
    expect(
      lines.find((line) => line.accountCode === SYSTEM_ACCOUNT_CODE.REVENUE_SERVICE)?.credit.amount,
    ).toBe(1000);
    expect(
      lines.find((line) => line.accountCode === SYSTEM_ACCOUNT_CODE.REVENUE_PRODUCT)?.credit.amount,
    ).toBe(500);
    expect(lines.reduce((sum, line) => sum + line.debit.amount - line.credit.amount, 0)).toBe(0);
    expect(entries.some((entry) => entry.postingKey === POSTING_KEY.order_cost)).toBe(false);
  });

  it("a performed walk-in service accrues commission under a SERVICE rule", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL, SALON));
    await writeModuleOverride({
      organizationId: shop.organizationId,
      moduleKey: MODULE_KEY.COMMISSION,
      effect: MODULE_OVERRIDE_EFFECT.PLATFORM_GRANT,
    });
    const people = await shop.actor.call(
      "get",
      `/orgs/${shop.organizationId}/sales/performers?locationId=${shop.locationId}`,
    );
    expect(people.status).toBe(200);
    const memberId = people.body.data[0].memberId as string;
    const rule = await shop.actor.call("post", `/orgs/${shop.organizationId}/commission/rules`, {
      subjectType: COMMISSION_SUBJECT_TYPE.MEMBER,
      memberId,
      targetType: COMMISSION_TARGET_TYPE.KIND,
      offeringKind: "SERVICE",
      calculation: COMMISSION_CALCULATION.PERCENT,
      percentBasisPoints: 1000,
    });
    expect(rule.status, JSON.stringify(rule.body)).toBe(201);
    const service = await serviceOf(shop);
    const contactId = await newContact(shop);
    const sold = await instantOrder(shop, {
      locationId: shop.locationId,
      contactId,
      lines: [{ ...service, quantity: 2, performedByMemberId: memberId }],
    });
    expect(sold.status).toBe(201);
    expect((await payOrder(shop, sold.order.orderId, { amount: 2000 })).status).toBe(201);
    await processOrganizationOutbox(shop.organizationId);
    expect(await commissionAmounts(shop, sold.order.orderId)).toEqual([200]);
    const line = sold.order.lines[0];
    if (line === undefined) throw new Error("expected performed line");
    const returned = await postReturn(
      shop.actor,
      { organizationId: shop.organizationId, orderId: sold.order.orderId },
      returnBody([{ orderLineId: line.orderLineId, quantity: 1 }]),
    );
    expect(returned.status, JSON.stringify(returned.body)).toBe(201);
    await processOrganizationOutbox(shop.organizationId);
    await processOrganizationOutbox(shop.organizationId);
    expect(await commissionAmounts(shop, sold.order.orderId)).toEqual([-100, 200]);
  });

  it("returning a service line writes no stock movement and refunds it", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL, SALON));
    const { order, line } = await paidService(shop);
    const before = await movementsOf(shop);
    const returned = await postReturn(
      shop.actor,
      { organizationId: shop.organizationId, orderId: order.orderId },
      returnBody([{ orderLineId: line.orderLineId, quantity: 1, disposition: "DAMAGED" }]),
    );
    expect(returned.status, JSON.stringify(returned.body)).toBe(201);
    expect(returned.body.data.refund.amount.amount).toBe(1000);
    expect(await movementsOf(shop)).toEqual(before);
    await processOrganizationOutbox(shop.organizationId);
    const entries = await journalsOf(shop, returned.body.data.salesReturnId);
    expect(entries.map((entry) => entry.postingKey)).toEqual([POSTING_KEY.sales_return_value]);
    expect(entries[0]?.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountCode: SYSTEM_ACCOUNT_CODE.SALES_RETURNS,
          debit: { amount: 1000, currency: "BDT" },
        }),
      ]),
    );
    const payment = await harness.connections.tenantShared
      .collection("payments")
      .findOne({ direction: "REFUND", "allocations.requestId": order.orderId });
    expect(payment?.["amount"].amount).toBe(1000);
  });

  it("an exchange can sell a service without writing stock", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL, SALON));
    const { order, line, service } = await paidService(shop);
    const exchanged = await postExchange(
      shop.actor,
      { organizationId: shop.organizationId, orderId: order.orderId },
      exchangeBody({
        returned: [{ orderLineId: line.orderLineId, quantity: 1 }],
        sold: [{ ...service, quantity: 1 }],
      }),
    );
    expect(exchanged.status, JSON.stringify(exchanged.body)).toBe(201);
    expect(exchanged.body.data.order.lines[0]).toMatchObject({
      kind: "SERVICE",
      unitCostSnapshot: null,
    });
    expect(exchanged.body.data.order.paymentStatus).toBe("PAID");
    expect(await movementsOf(shop)).toEqual([]);
  });
});

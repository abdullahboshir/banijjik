import {
  COMMISSION_CALCULATION,
  COMMISSION_SUBJECT_TYPE,
  COMMISSION_TARGET_TYPE,
} from "@banijjik/contracts/commission";
import { MODULE_KEY, MODULE_OVERRIDE_EFFECT } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { worldFor } from "../../../../test-support/catalog-world.js";
import { ContractTemplateReader } from "../../../../test-support/module-contract/contract-template-reader.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { writeModuleOverride } from "../../../../test-support/entitlement-world.js";
import { processOrganizationOutbox } from "../../../../test-support/outbox-replay.js";
import { newContact, payOrder } from "../../../../test-support/sales-return-world.js";
import { instantOrder, shopOf, type SalesShop } from "../../../../test-support/sales-api-world.js";
import {
  exchangeBody,
  newProduct,
  postExchange,
} from "../../../../test-support/sales-exchange-world.js";
import { registerCommissionHandlers } from "../../../../routes/commission-adapters.js";
import { buildModuleRegistry } from "../../../../routes/module-registry.js";
import {
  buildOrganizationConfigPorts,
  buildResolvedConfigSources,
} from "../../../../routes/organization-config-ports.js";
import { systemClock } from "../../../../kernel/time/index.js";
import { buildOrgConfigService } from "../../../platform/entitlement/index.js";
import { buildIndustryTemplateReader } from "../../../platform/industry/index.js";

registerIamApiModels();
const RETAIL = { industryTemplateKey: "RETAIL" };
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const UNIT_PRICE = 1000;
const NEW_UNIT_PRICE = 600;
const RATE_BASIS_POINTS = 1000;
let harness: IamApiHarness;

beforeAll(async () => {
  // A template that allows every module, so the commission add-on can be granted here.
  harness = await startIamApi({ templateReader: new ContractTemplateReader(), tenantRouters: [] });
});
afterAll(async () => {
  await harness.dispose();
});

/** The commission accrual handler, registered the way the worker registers it. */
function registerCommissionAccrual(): void {
  const registry = buildModuleRegistry();
  const orgConfig = buildOrgConfigService({
    registry,
    clock: systemClock,
    ...buildOrganizationConfigPorts(),
    ...buildResolvedConfigSources(registry),
    templates: buildIndustryTemplateReader(systemClock),
  });
  registerCommissionHandlers(systemClock, orgConfig);
}

/** The member the sales screens offer as a performer at the location (ADR-135). */
async function performerOf(shop: SalesShop): Promise<string> {
  const response = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/sales/performers?locationId=${shop.locationId}`,
  );
  expect(response.status).toBe(HTTP_OK);
  const performers = response.body.data as readonly { memberId: string }[];
  const first = performers[0];
  if (first === undefined) throw new Error("expected a performer at the location");
  return first.memberId;
}

/** The commission amounts of one order, read through the commission list. */
async function orderEntryAmounts(shop: SalesShop, orderId: string): Promise<number[]> {
  const response = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/commission/entries?limit=100`,
  );
  expect(response.status).toBe(HTTP_OK);
  const entries = response.body.data as readonly {
    sourceId: string;
    amount: { amount: number };
  }[];
  return entries
    .filter((entry) => entry.sourceId === orderId)
    .map((entry) => entry.amount.amount)
    .sort((left, right) => left - right);
}

describe("exchange commission API", () => {
  it("the returned line's commission goes down and the new order's lines accrue", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    for (const moduleKey of [MODULE_KEY.BOOKING, MODULE_KEY.COMMISSION]) {
      await writeModuleOverride({
        organizationId: shop.organizationId,
        moduleKey,
        effect: MODULE_OVERRIDE_EFFECT.PLATFORM_GRANT,
      });
    }
    const memberId = await performerOf(shop);
    const rule = await world.alice.call("post", `/orgs/${shop.organizationId}/commission/rules`, {
      subjectType: COMMISSION_SUBJECT_TYPE.MEMBER,
      memberId,
      targetType: COMMISSION_TARGET_TYPE.ALL,
      calculation: COMMISSION_CALCULATION.PERCENT,
      percentBasisPoints: RATE_BASIS_POINTS,
    });
    expect(rule.status, JSON.stringify(rule.body)).toBe(HTTP_CREATED);
    const contactId = await newContact(shop);
    const sellable = await newProduct(shop, UNIT_PRICE);
    const sold = await instantOrder(shop, {
      locationId: shop.locationId,
      contactId,
      lines: [{ ...sellable, quantity: 2, performedByMemberId: memberId }],
    });
    expect(sold.status).toBe(HTTP_CREATED);
    const line = sold.order.lines[0];
    if (line === undefined) throw new Error("expected a sold line");
    const paid = await payOrder(shop, sold.order.orderId, {
      amount: sold.order.totals.grandTotal.amount,
    });
    expect(paid.status).toBe(HTTP_CREATED);
    const cheaper = await newProduct(shop, NEW_UNIT_PRICE);

    const exchanged = await postExchange(
      shop.actor,
      { organizationId: shop.organizationId, orderId: sold.order.orderId },
      exchangeBody({
        returned: [{ orderLineId: line.orderLineId, quantity: 1 }],
        sold: [{ ...cheaper, quantity: 1, performedByMemberId: memberId }],
      }),
    );
    expect(exchanged.status, JSON.stringify(exchanged.body)).toBe(HTTP_CREATED);
    const newOrderId = exchanged.body.data.order.orderId as string;

    registerCommissionAccrual();
    await processOrganizationOutbox(shop.organizationId);

    // Two units at 10% accrue 200; returning one unit takes half back, so 100 stays on the original.
    expect(await orderEntryAmounts(shop, sold.order.orderId)).toEqual([
      -(UNIT_PRICE * RATE_BASIS_POINTS) / 10_000,
      (UNIT_PRICE * 2 * RATE_BASIS_POINTS) / 10_000,
    ]);
    expect(await orderEntryAmounts(shop, newOrderId)).toEqual([
      (NEW_UNIT_PRICE * RATE_BASIS_POINTS) / 10_000,
    ]);
  });
});

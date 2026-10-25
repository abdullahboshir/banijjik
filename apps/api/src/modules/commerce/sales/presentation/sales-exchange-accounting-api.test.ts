import { POSTING_KEY, SYSTEM_ACCOUNT_CODE } from "@banijjik/contracts/accounting";
import { eventHandlerRegistry } from "../../../../kernel/events/index.js";
import { runEventHandler } from "../../../../kernel/events/handler-runner.js";
import type { ModuleEffectiveness } from "../../../../kernel/events/module-effectiveness.js";
import type { OutboxEventDocument } from "../../../../kernel/events/outbox-event.schema.js";
import { registerAccountingAndExpenseHandlers } from "../../../../routes/accounting-event-handlers.js";
import { MongoJournalRepository } from "../../accounting/index.js";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { outboxModel } from "../../../../test-support/event-fixtures.js";
import { withOrganizationContext } from "../../../../test-support/organization-context.js";
import { asId, type OrganizationId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { shopOf } from "../../../../test-support/sales-api-world.js";
import {
  exchangeBody,
  newProduct,
  paidSale,
  postExchange,
} from "../../../../test-support/sales-exchange-world.js";

registerIamApiModels();
const RETAIL = { industryTemplateKey: "RETAIL" };
const HTTP_CREATED = 201;
const EFFECTIVE: ModuleEffectiveness = { isEffective: async () => true };
const TRIAL_BALANCE_DATE = "2099-12-31";
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
  registerAccountingAndExpenseHandlers();
});
afterAll(async () => {
  await harness.dispose();
});

/**
 * Runs every handler of the organization's events in outbox order, as the worker would. Each run
 * goes through the exactly-once marker, so a second call is a replay that must post nothing.
 */
async function processOutbox(organizationId: string): Promise<void> {
  const events = await outboxModel()
    .find({ organizationId })
    .sort({ occurredAt: 1, streamSequence: 1 })
    .lean<OutboxEventDocument[]>();
  for (const event of events) {
    for (const handler of eventHandlerRegistry.handlersFor(event)) {
      await runEventHandler(
        {
          eventId: event.eventId,
          handlerKey: handler.handlerKey,
          type: event.type,
          organizationId,
        },
        eventHandlerRegistry,
        EFFECTIVE,
      );
    }
  }
}

describe("exchange postings API: accounting", () => {
  it("the exchange posts the return and the new order once each, also on event replay (trial balance: the contact's store credit liability equals creditLeft)", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const organizationId = asId<OrganizationId>(shop.organizationId);
    const { order, line } = await paidSale(shop, 2);
    const cheaper = await newProduct(shop, 600);
    const exchanged = await postExchange(
      shop.actor,
      { organizationId: shop.organizationId, orderId: order.orderId },
      exchangeBody({
        returned: [{ orderLineId: line.orderLineId, quantity: 1 }],
        sold: [{ ...cheaper, quantity: 1 }],
      }),
    );
    expect(exchanged.status).toBe(HTTP_CREATED);
    const salesReturnId = exchanged.body.data.salesReturn.salesReturnId as string;
    const newOrderId = exchanged.body.data.order.orderId as string;

    const journals = new MongoJournalRepository();
    await processOutbox(shop.organizationId);
    await processOutbox(shop.organizationId);

    await withOrganizationContext(organizationId, async () => {
      const entries = await journals.list({ page: 1, limit: 100 });
      const countOf = (sourceId: string, postingKey: string) =>
        entries.items.filter(
          (entry) => entry.sourceId === sourceId && entry.postingKey === postingKey,
        ).length;
      expect(countOf(salesReturnId, POSTING_KEY.sales_return_value)).toBe(1);
      expect(countOf(newOrderId, POSTING_KEY.order_revenue)).toBe(1);
      expect(countOf(order.orderId, POSTING_KEY.order_revenue)).toBe(1);
    });
    const trial = await shop.actor.call(
      "get",
      `/orgs/${shop.organizationId}/accounting/trial-balance?asOf=${TRIAL_BALANCE_DATE}`,
    );
    expect(trial.status).toBe(200);
    expect(trial.body.data.balances).toBe(true);
    // A liability is credit-normal: the store credit the return created, less the part the new order spent.
    const liability = (
      trial.body.data.accounts as { accountCode: string; balance: { amount: number } }[]
    ).find((account) => account.accountCode === SYSTEM_ACCOUNT_CODE.STORE_CREDIT_LIABILITY);
    expect(liability?.balance.amount).toBe(exchanged.body.data.storeCreditLeft.amount);
  });
});

import { CURRENCY_CODE } from "@banijjik/contracts";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { ORDER_STATUS } from "@banijjik/contracts/sales";
import {
  WEBSITE_DELIVERY_CHARGE_SETTING_KEY,
  type CheckoutSelection,
  type StorefrontCommandContext,
} from "@banijjik/contracts/website";
import { asId, newId, type OrganizationId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runInOrganizationContext } from "../kernel/tenancy/index.js";
import { MongoPaymentSummaryRepository } from "../modules/commerce/payment/index.js";
import { MongoOrderRepository } from "../modules/commerce/sales/index.js";
import { buildAuditRecorder } from "../modules/core/audit/index.js";
import { buildOrgConfigService } from "../modules/platform/entitlement/index.js";
import { buildIndustryTemplateReader } from "../modules/platform/industry/index.js";
import { startCatalogApi, worldFor } from "../test-support/catalog-world.js";
import { registerIamApiModels, type IamApiHarness } from "../test-support/iam-api-harness.js";
import {
  addCustomer,
  addInventoryItem,
  levelOf,
  publishOffering,
  receiveStock,
  setSetting,
  shopOf,
} from "../test-support/sales-api-world.js";
import { buildModuleRegistry, MODULE_MANIFESTS } from "./module-registry.js";
import {
  buildOrganizationConfigPorts,
  buildResolvedConfigSources,
} from "./organization-config-ports.js";
import { buildOrgStorefrontConfigReaderAdapter } from "./storefront-checkout-adapters.js";
import { buildStorefrontCommerceCommands } from "./storefront-commerce-commands.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const RICE_PRICE = 10_000;
const GRAMS_PER_PACK = 1_000;
const DELIVERY_CHARGE = 500;

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

describe("storefront commerce composition (Card 4.3 A5A)", () => {
  async function setup() {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const inventoryItemId = await addInventoryItem(shop, "Rice");
    const product = await publishOffering(shop, {
      kind: "PRODUCT",
      name: "Rice Pack",
      priceAmount: RICE_PRICE,
      stockComponents: [{ inventoryItemId, quantity: GRAMS_PER_PACK }],
    });
    await receiveStock(shop, [
      { inventoryItemId, quantity: GRAMS_PER_PACK * 10, unitCostAmount: 60 },
    ]);
    const contactId = await addCustomer(shop, "Storefront Guest", "+8801700000000");

    const registry = buildModuleRegistry();
    const orgConfig = buildOrgConfigService({
      registry,
      clock: harness.clock,
      ...buildOrganizationConfigPorts(),
      ...buildResolvedConfigSources(registry),
      templates: buildIndustryTemplateReader(harness.clock),
    });
    const audit = buildAuditRecorder(harness.clock);
    const commerce = buildStorefrontCommerceCommands({
      clock: harness.clock,
      audit,
      orgConfig,
      manifests: MODULE_MANIFESTS,
      orgConfigReader: buildOrgStorefrontConfigReaderAdapter(orgConfig, MODULE_MANIFESTS),
    });

    return { world, shop, product, contactId, inventoryItemId, orgConfig, commerce };
  }

  function selectionOf(product: { offeringId: string; variantId: string }): CheckoutSelection {
    return {
      selectionId: "selection-1",
      selection: {
        kind: "PRODUCT",
        offeringId: product.offeringId,
        variantId: product.variantId,
        quantity: 2,
        modifierOptionIds: [],
      },
      customFields: {},
    };
  }

  it("prices selections with the real quoter and adds the configured delivery charge", async () => {
    const { shop, product, orgConfig, commerce } = await setup();
    const selections = [selectionOf(product)];

    const pickup = await runInOrganizationContext(shop.organizationId, () =>
      commerce.catalogQuoter.priceSelections({
        organizationId: shop.organizationId,
        locationId: shop.locationId,
        selections,
        fulfillment: { method: "PICKUP" },
      }),
    );

    expect(pickup.lines).toHaveLength(1);
    expect(pickup.lines[0]?.subtotal).toEqual({
      amount: RICE_PRICE * 2,
      currency: CURRENCY_CODE.BDT,
    });
    expect(pickup.lines[0]?.discount.amount).toBe(0);
    expect(pickup.lines[0]?.tax.amount).toBe(0);
    expect(pickup.total.amount).toBe(RICE_PRICE * 2);
    expect(pickup.deliveryCharge.amount).toBe(0);

    await setSetting(shop, WEBSITE_DELIVERY_CHARGE_SETTING_KEY, DELIVERY_CHARGE);

    const courier = await runInOrganizationContext(shop.organizationId, () =>
      commerce.catalogQuoter.priceSelections({
        organizationId: shop.organizationId,
        locationId: shop.locationId,
        selections,
        fulfillment: { method: "COURIER" },
      }),
    );

    expect(courier.deliveryCharge).toEqual({
      amount: DELIVERY_CHARGE,
      currency: CURRENCY_CODE.BDT,
    });
    expect(courier.total.amount).toBe(RICE_PRICE * 2 + DELIVERY_CHARGE);

    const config = await runInOrganizationContext(shop.organizationId, () =>
      orgConfig.forOrganization(shop.organizationId),
    );
    expect(courier.configVersion).toBe(config.config.configVersion);
  });

  it("places a real order with an atomic number, payment summary and stock reservation", async () => {
    const { shop, product, contactId, inventoryItemId, commerce } = await setup();
    const before = await levelOf(shop, inventoryItemId);
    expect(before).toEqual({ onHand: GRAMS_PER_PACK * 10, reserved: 0 });

    const context: StorefrontCommandContext = {
      organizationId: shop.organizationId,
      locationId: shop.locationId,
      contactId,
      checkoutId: newId(),
      actorUserId: null,
    };
    const link = await runInOrganizationContext(shop.organizationId, () =>
      commerce.publicOrders.place(context, {
        selections: [selectionOf(product)],
        recipient: { name: "Storefront Guest", phoneE164: "+8801711111111" },
        fulfillment: { method: "PICKUP" },
      }),
    );

    expect(link.requestType).toBe("ORDER");
    expect(link.status).toBe(ORDER_STATUS.PLACED);
    expect(link.publicNumber).toMatch(/^\d{6}$/);
    expect(link.paymentRequired.amount).toBe(RICE_PRICE * 2);

    const order = await runInOrganizationContext(shop.organizationId, () =>
      new MongoOrderRepository().findById(asId(link.requestId)),
    );
    expect(order?.source).toBe("STOREFRONT");
    expect(order?.checkoutId).toBe(context.checkoutId);
    expect(order?.hasStockLines).toBe(true);
    expect(order?.totals.grandTotal.amount).toBe(RICE_PRICE * 2);

    const summary = await runInOrganizationContext(shop.organizationId, () =>
      new MongoPaymentSummaryRepository().findByRequest(
        asId<OrganizationId>(shop.organizationId),
        PAYMENT_REQUEST_TYPE.ORDER,
        link.requestId,
      ),
    );
    expect(summary?.total.amount).toBe(RICE_PRICE * 2);
    expect(summary?.due.amount).toBe(RICE_PRICE * 2);

    const after = await levelOf(shop, inventoryItemId);
    expect(after).toEqual({ onHand: GRAMS_PER_PACK * 10, reserved: GRAMS_PER_PACK * 2 });
  });
});

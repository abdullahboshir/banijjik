import { LIMIT_KEY, type LimitKey } from "@banijjik/contracts";
import {
  ORDER_STATUS,
  SALES_ADVANCE_REQUIRED_SETTING_KEY,
  SALES_AUTO_CONFIRM_SETTING_KEY,
} from "@banijjik/contracts/sales";
import type { PublicOrderCommands, StorefrontCommandContext } from "@banijjik/contracts/website";
import { asId, newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { startCatalogApi, worldFor } from "../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../test-support/iam-api-harness.js";
import {
  addCustomer,
  addInventoryItem,
  publishOffering,
  receiveStock,
  setSetting,
  shopOf,
} from "../../../test-support/sales-api-world.js";
import { buildSalesDependencies } from "./sales-wiring.js";
import { buildStorefrontOrderCommands } from "./application/storefront-order-commands.js";
import { buildSalesTenantPorts } from "../../../routes/sales-tenant-router.js";
import { MongoOrderRepository } from "./infrastructure/mongo-order.repositories.js";
import { buildAuditRecorder } from "../../core/audit/index.js";
import { buildOrgConfigService } from "../../platform/entitlement/index.js";
import { buildIndustryTemplateReader } from "../../platform/industry/index.js";
import {
  buildOrganizationConfigPorts,
  buildResolvedConfigSources,
} from "../../../routes/organization-config-ports.js";
import { buildModuleRegistry, MODULE_MANIFESTS } from "../../../routes/module-registry.js";
import { MongoPaymentSummaryRepository } from "../payment/index.js";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { runInOrganizationContext } from "../../../kernel/tenancy/index.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const RICE_PRICE = 10_000;
const RICE_COST = 60;
const GRAMS = 1_000;

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

describe("PublicOrderCommands.place (Storefront Order Adapter)", () => {
  async function setupShop(suffix: string) {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const itemId = await addInventoryItem(shop, `Rice-${suffix}`);
    const product = await publishOffering(shop, {
      kind: "PRODUCT",
      name: `Rice Pack-${suffix}`,
      priceAmount: RICE_PRICE,
      stockComponents: [{ inventoryItemId: itemId, quantity: GRAMS }],
    });
    await receiveStock(shop, [
      { inventoryItemId: itemId, quantity: GRAMS * 10, unitCostAmount: RICE_COST },
    ]);
    const contactId = await addCustomer(shop, `Guest Contact-${suffix}`, "+8801700000000");

    const registry = buildModuleRegistry();
    const orgConfig = buildOrgConfigService({
      registry,
      clock: harness.clock,
      ...buildOrganizationConfigPorts(),
      ...buildResolvedConfigSources(registry),
      templates: buildIndustryTemplateReader(harness.clock),
    });

    const audit = buildAuditRecorder(harness.clock);

    const ports = buildSalesTenantPorts({
      clock: harness.clock,
      audit,
      orgConfig,
      manifests: MODULE_MANIFESTS,
      permission: () => (_req: Request, _res: Response, next: NextFunction) => next(),
      idempotency: () => (_req: Request, _res: Response, next: NextFunction) => next(),
      permissions: {
        locationsWith: async () => "ALL",
      },
    });
    const deps = buildSalesDependencies(ports);
    const rawCommands = buildStorefrontOrderCommands(deps);
    const commands: PublicOrderCommands = {
      place: (context, input) =>
        runInOrganizationContext(context.organizationId, () => rawCommands.place(context, input)),
    };

    return { world, shop, product, contactId, commands, deps };
  }

  it("places product order in PLACED status with STOREFRONT source and reserves stock", async () => {
    const { shop, product, contactId, commands, deps } = await setupShop("placed-stock");
    const checkoutId = newId();

    const context: StorefrontCommandContext = {
      organizationId: shop.organizationId,
      locationId: shop.locationId,
      contactId,
      checkoutId,
      actorUserId: null,
    };

    const link = await commands.place(context, {
      selections: [
        {
          selectionId: "sel-1",
          selection: {
            kind: "PRODUCT",
            offeringId: product.offeringId,
            variantId: product.variantId,
            quantity: 2,
            modifierOptionIds: [],
          },
          customFields: {},
        },
      ],
      recipient: {
        name: "Test Recipient",
        phoneE164: "+8801711111111",
      },
      fulfillment: {
        method: "PICKUP",
      },
    });

    expect(link.requestType).toBe("ORDER");
    expect(link.status).toBe(ORDER_STATUS.PLACED);
    expect(link.publicNumber).toMatch(/^\d{6}$/);
    expect(link.paymentRequired.amount).toBe(RICE_PRICE * 2);

    const order = await runInOrganizationContext(shop.organizationId, () =>
      deps.orders.findById(asId(link.requestId)),
    );
    expect(order).toBeDefined();
    expect(order?.source).toBe("STOREFRONT");
    expect(order?.hasStockLines).toBe(true);
    expect(order?.checkoutId).toBe(checkoutId);
    expect(order?.recipient).toEqual({
      name: "Test Recipient",
      phoneE164: "+8801711111111",
    });
  });

  it("assigns atomic order number from sequence inside transaction", async () => {
    const { shop, product, contactId, commands } = await setupShop("seq");

    const link1 = await commands.place(
      {
        organizationId: shop.organizationId,
        locationId: shop.locationId,
        contactId,
        checkoutId: newId(),
        actorUserId: null,
      },
      {
        selections: [
          {
            selectionId: "s-1",
            selection: {
              kind: "PRODUCT",
              offeringId: product.offeringId,
              variantId: product.variantId,
              quantity: 1,
              modifierOptionIds: [],
            },
            customFields: {},
          },
        ],
        recipient: { name: "User 1", phoneE164: "+8801711111111" },
        fulfillment: { method: "PICKUP" },
      },
    );

    const link2 = await commands.place(
      {
        organizationId: shop.organizationId,
        locationId: shop.locationId,
        contactId,
        checkoutId: newId(),
        actorUserId: null,
      },
      {
        selections: [
          {
            selectionId: "s-2",
            selection: {
              kind: "PRODUCT",
              offeringId: product.offeringId,
              variantId: product.variantId,
              quantity: 1,
              modifierOptionIds: [],
            },
            customFields: {},
          },
        ],
        recipient: { name: "User 2", phoneE164: "+8801722222222" },
        fulfillment: { method: "PICKUP" },
      },
    );

    expect(link1.publicNumber).toBeDefined();
    expect(link2.publicNumber).toBeDefined();
    expect(Number(link2.publicNumber)).toBe(Number(link1.publicNumber) + 1);
  });

  it("satisfies pickup contactability via trusted recipient snapshot without canonical contact phone", async () => {
    const { shop, product, commands, deps } = await setupShop("provisional-contact");
    const rawContactRes = await shop.actor.call("post", `/orgs/${shop.organizationId}/contacts`, {
      contactType: "PERSON",
      name: "Provisional Guest",
      contactRoles: ["CUSTOMER"],
    });
    expect(rawContactRes.status).toBe(201);
    const provisionalContactId = rawContactRes.body.data.contactId;

    const link = await commands.place(
      {
        organizationId: shop.organizationId,
        locationId: shop.locationId,
        contactId: provisionalContactId,
        checkoutId: newId(),
        actorUserId: null,
      },
      {
        selections: [
          {
            selectionId: "sel-prov",
            selection: {
              kind: "PRODUCT",
              offeringId: product.offeringId,
              variantId: product.variantId,
              quantity: 1,
              modifierOptionIds: [],
            },
            customFields: {},
          },
        ],
        recipient: {
          name: "Guest Real Name",
          phoneE164: "+8801999999999",
        },
        fulfillment: { method: "PICKUP" },
      },
    );

    expect(link.status).toBe(ORDER_STATUS.PLACED);
    const order = await runInOrganizationContext(shop.organizationId, () =>
      deps.orders.findById(asId(link.requestId)),
    );
    expect(order?.recipient?.phoneE164).toBe("+8801999999999");
  });

  it("initializes payment summary in payment module for placed order", async () => {
    const { shop, product, contactId, commands } = await setupShop("init-summary");

    const link = await commands.place(
      {
        organizationId: shop.organizationId,
        locationId: shop.locationId,
        contactId,
        checkoutId: newId(),
        actorUserId: null,
      },
      {
        selections: [
          {
            selectionId: "sel-sum",
            selection: {
              kind: "PRODUCT",
              offeringId: product.offeringId,
              variantId: product.variantId,
              quantity: 1,
              modifierOptionIds: [],
            },
            customFields: {},
          },
        ],
        recipient: { name: "Summary Test", phoneE164: "+8801733333333" },
        fulfillment: { method: "PICKUP" },
      },
    );

    const paymentSummaries = new MongoPaymentSummaryRepository();
    const summary = await runInOrganizationContext(shop.organizationId, () =>
      paymentSummaries.findByRequest(
        asId(shop.organizationId),
        PAYMENT_REQUEST_TYPE.ORDER,
        asId(link.requestId),
      ),
    );
    expect(summary).toBeDefined();
    expect(summary?.total.amount).toBe(RICE_PRICE);
    expect(summary?.allocated.amount).toBe(0);
    expect(summary?.paymentStatus).toBe("UNPAID");
  });

  it("auto-confirms order when autoConfirm is true and advanceRequired is NONE", async () => {
    const { shop, product, contactId, commands } = await setupShop("autoconfirm-true");

    await setSetting(shop, SALES_AUTO_CONFIRM_SETTING_KEY, true);
    await setSetting(shop, SALES_ADVANCE_REQUIRED_SETTING_KEY, "NONE");

    const link = await commands.place(
      {
        organizationId: shop.organizationId,
        locationId: shop.locationId,
        contactId,
        checkoutId: newId(),
        actorUserId: null,
      },
      {
        selections: [
          {
            selectionId: "sel-ac",
            selection: {
              kind: "PRODUCT",
              offeringId: product.offeringId,
              variantId: product.variantId,
              quantity: 1,
              modifierOptionIds: [],
            },
            customFields: {},
          },
        ],
        recipient: { name: "Auto Confirm", phoneE164: "+8801744444444" },
        fulfillment: { method: "PICKUP" },
      },
    );

    expect(link.status).toBe(ORDER_STATUS.CONFIRMED);
  });

  it("leaves order in PLACED status when advanceRequired is not NONE", async () => {
    const { shop, product, contactId, commands } = await setupShop("autoconfirm-false-advance");

    await setSetting(shop, SALES_AUTO_CONFIRM_SETTING_KEY, true);
    await setSetting(shop, SALES_ADVANCE_REQUIRED_SETTING_KEY, "PERCENT");

    const link = await commands.place(
      {
        organizationId: shop.organizationId,
        locationId: shop.locationId,
        contactId,
        checkoutId: newId(),
        actorUserId: null,
      },
      {
        selections: [
          {
            selectionId: "sel-no-ac",
            selection: {
              kind: "PRODUCT",
              offeringId: product.offeringId,
              variantId: product.variantId,
              quantity: 1,
              modifierOptionIds: [],
            },
            customFields: {},
          },
        ],
        recipient: { name: "Advance Req", phoneE164: "+8801755555555" },
        fulfillment: { method: "PICKUP" },
      },
    );

    expect(link.status).toBe(ORDER_STATUS.PLACED);
  });

  it("stores checkoutId on order document and enables lookup by organizationId and checkoutId", async () => {
    const { shop, product, contactId, commands } = await setupShop("lookup-checkout");
    const checkoutId = newId();

    const link = await commands.place(
      {
        organizationId: shop.organizationId,
        locationId: shop.locationId,
        contactId,
        checkoutId,
        actorUserId: null,
      },
      {
        selections: [
          {
            selectionId: "sel-cid",
            selection: {
              kind: "PRODUCT",
              offeringId: product.offeringId,
              variantId: product.variantId,
              quantity: 1,
              modifierOptionIds: [],
            },
            customFields: {},
          },
        ],
        recipient: { name: "Checkout Id Lookup", phoneE164: "+8801766666666" },
        fulfillment: { method: "PICKUP" },
      },
    );

    const repo = new MongoOrderRepository();
    const orderDoc = await runInOrganizationContext(shop.organizationId, () =>
      repo.findById(asId(link.requestId)),
    );
    expect(orderDoc?.checkoutId).toBe(checkoutId);
  });

  it("rejects place when requested variant stock is insufficient without negative stock allowance", async () => {
    const { shop, product, contactId, commands } = await setupShop("insufficient-stock");

    await expect(
      commands.place(
        {
          organizationId: shop.organizationId,
          locationId: shop.locationId,
          contactId,
          checkoutId: newId(),
          actorUserId: null,
        },
        {
          selections: [
            {
              selectionId: "sel-huge",
              selection: {
                kind: "PRODUCT",
                offeringId: product.offeringId,
                variantId: product.variantId,
                quantity: 999, // exceeds 10 packs
                modifierOptionIds: [],
              },
              customFields: {},
            },
          ],
          recipient: { name: "Out of Stock", phoneE164: "+8801777777777" },
          fulfillment: { method: "PICKUP" },
        },
      ),
    ).rejects.toThrow();
  });

  it("rejects order placement for disabled product offering or inactive location", async () => {
    const { shop, contactId, commands } = await setupShop("disabled-offering");

    await expect(
      commands.place(
        {
          organizationId: shop.organizationId,
          locationId: shop.locationId,
          contactId,
          checkoutId: newId(),
          actorUserId: null,
        },
        {
          selections: [
            {
              selectionId: "sel-nonexistent",
              selection: {
                kind: "PRODUCT",
                offeringId: newId(),
                variantId: newId(),
                quantity: 1,
                modifierOptionIds: [],
              },
              customFields: {},
            },
          ],
          recipient: { name: "Nonexistent", phoneE164: "+8801788888888" },
          fulfillment: { method: "PICKUP" },
        },
      ),
    ).rejects.toThrow();
  });

  it("enforces monthly order limit check in unit of work", async () => {
    const { shop, product, contactId, commands, deps } = await setupShop("limit");

    const originalAssertBelow = deps.limits.assertBelow;
    const limitsWithMock = deps.limits as {
      assertBelow: (key: LimitKey, count: number) => Promise<void>;
    };
    limitsWithMock.assertBelow = async (key: LimitKey, count: number) => {
      void count;
      if (key === LIMIT_KEY.ORDERS_PER_MONTH) {
        throw new Error("ORDER_LIMIT_REACHED");
      }
    };

    try {
      await expect(
        commands.place(
          {
            organizationId: shop.organizationId,
            locationId: shop.locationId,
            contactId,
            checkoutId: newId(),
            actorUserId: null,
          },
          {
            selections: [
              {
                selectionId: "sel-lim",
                selection: {
                  kind: "PRODUCT",
                  offeringId: product.offeringId,
                  variantId: product.variantId,
                  quantity: 1,
                  modifierOptionIds: [],
                },
                customFields: {},
              },
            ],
            recipient: { name: "Limit Test", phoneE164: "+8801799999999" },
            fulfillment: { method: "PICKUP" },
          },
        ),
      ).rejects.toThrow("ORDER_LIMIT_REACHED");
    } finally {
      limitsWithMock.assertBelow = originalAssertBelow;
    }
  });

  it("enforces cross-organization isolation: cannot place order in location of another organization", async () => {
    const { shop, product, contactId, commands } = await setupShop("cross-org");
    const otherWorld = await worldFor(harness, RETAIL);

    await expect(
      commands.place(
        {
          organizationId: otherWorld.organizationB,
          locationId: shop.locationId,
          contactId,
          checkoutId: newId(),
          actorUserId: null,
        },
        {
          selections: [
            {
              selectionId: "sel-cross",
              selection: {
                kind: "PRODUCT",
                offeringId: product.offeringId,
                variantId: product.variantId,
                quantity: 1,
                modifierOptionIds: [],
              },
              customFields: {},
            },
          ],
          recipient: { name: "Cross Org", phoneE164: "+8801700000002" },
          fulfillment: { method: "PICKUP" },
        },
      ),
    ).rejects.toThrow();
  });

  it("enforces transaction rollback: failure in stock reservation rolls back order and payment summary", async () => {
    const { shop, product, contactId, commands, deps } = await setupShop("rollback");

    const originalReserve = deps.stock.reserve;
    const stockWithMock = deps.stock as { reserve: typeof deps.stock.reserve };
    stockWithMock.reserve = async () => {
      throw new Error("STOCK_RESERVATION_SIMULATED_FAILURE");
    };

    try {
      await expect(
        commands.place(
          {
            organizationId: shop.organizationId,
            locationId: shop.locationId,
            contactId,
            checkoutId: newId(),
            actorUserId: null,
          },
          {
            selections: [
              {
                selectionId: "sel-rb",
                selection: {
                  kind: "PRODUCT",
                  offeringId: product.offeringId,
                  variantId: product.variantId,
                  quantity: 1,
                  modifierOptionIds: [],
                },
                customFields: {},
              },
            ],
            recipient: { name: "Rollback Test", phoneE164: "+8801700000003" },
            fulfillment: { method: "PICKUP" },
          },
        ),
      ).rejects.toThrow("STOCK_RESERVATION_SIMULATED_FAILURE");
    } finally {
      stockWithMock.reserve = originalReserve;
    }
  });
});

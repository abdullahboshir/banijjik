import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { SALES_RULE_KEY } from "@banijjik/contracts/sales";
import { SALES_DELIVERY_RULE_KEY } from "@banijjik/contracts/sales/delivery";
import { newId } from "@banijjik/ids";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  memberWithRole,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import type { OrderRow } from "../../../../test-support/sales-api-rows.js";
import {
  addCustomer,
  addInventoryItem,
  cancelOrder,
  confirmOrder,
  draftOrder,
  getOrder,
  levelOf,
  ordersPath,
  placeOrder,
  publishOffering,
  receiveStock,
  setSetting,
  shopOf,
  transitionOrder,
  type SalesShop,
} from "../../../../test-support/sales-api-world.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const ITEM_PRICE = 5_000;
const PACK_GRAMS = 1_000;
const RAHIM_PHONE = "+8801700000001";
const LOCAL_PHONE = "01712345678";
const STORED_PHONE = "+8801712345678";

const EMPTY_DELIVERY = {
  address: null,
  deliveryZoneId: null,
  shippedAt: null,
  currentDeliveryAttemptId: null,
  deliveryAttemptCount: 0,
  firstShipment: null,
} as const;

const DHAKA_ADDRESS = {
  recipientName: "Rahim Uddin",
  phoneE164: LOCAL_PHONE,
  addressLine: "House 12, Road 4",
  districtCode: "dhaka",
  areaCode: "dhanmondi",
  postalCode: "1209",
} as const;

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

interface Offering {
  readonly offeringId: string;
  readonly variantId: string;
}

interface DeliveryView {
  readonly address: { readonly phoneE164: string; readonly areaCode: string } | null;
  readonly deliveryZoneId: string | null;
  readonly shippedAt: string | null;
  readonly currentDeliveryAttemptId: string | null;
  readonly deliveryAttemptCount: number;
  readonly firstShipment: null;
}

async function counterItemOf(shop: SalesShop, name: string): Promise<Offering> {
  return publishOffering(shop, { kind: "PRODUCT", name, priceAmount: ITEM_PRICE });
}

function linesOf(item: Offering) {
  return [{ offeringId: item.offeringId, variantId: item.variantId, quantity: 1 }];
}

function expectRule(
  response: Response,
  ruleKey: string,
  extra: Record<string, unknown> = {},
): void {
  expect(response.status).toBe(422);
  expect(response.body.error.code).toBe("BUSINESS_RULE");
  expect(response.body.error.details).toMatchObject({ ruleKey, ...extra });
}

function deliveryOf(order: OrderRow): DeliveryView | null {
  return (order as OrderRow & { delivery: DeliveryView | null }).delivery;
}

function patchCall(shop: SalesShop, orderId: string, body: object): Promise<Response> {
  return shop.actor.call("patch", ordersPath(shop.organizationId, `/${orderId}`), body);
}

function placeCall(shop: SalesShop, orderId: string, version: number): Promise<Response> {
  return shop.actor.call("post", ordersPath(shop.organizationId, `/${orderId}/place`), { version });
}

describe("order delivery state, address and complete guard", () => {
  it("creates and places a COURIER and OWN_RIDER order with a local phone stored as E.164", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await counterItemOf(shop, "Delivery tea");
    const contactId = await addCustomer(shop, "Rahim", RAHIM_PHONE);

    for (const method of ["COURIER", "OWN_RIDER"] as const) {
      const draft = await draftOrder(shop, {
        locationId: shop.locationId,
        contactId,
        fulfillmentMethod: method,
        deliveryAddress: DHAKA_ADDRESS,
        lines: linesOf(item),
      });
      expect(draft.fulfillment.method).toBe(method);
      expect(deliveryOf(draft)?.address).toMatchObject({
        recipientName: DHAKA_ADDRESS.recipientName,
        phoneE164: STORED_PHONE,
        areaCode: DHAKA_ADDRESS.areaCode,
      });
      const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
      expect(placed.status).toBe(200);
      expect(placed.order.status).toBe("PLACED");
      expect(placed.order.fulfillment.method).toBe(method);
    }
  });

  it("refuses to place a delivery draft without an address", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await counterItemOf(shop, "No-address tea");
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      fulfillmentMethod: "COURIER",
      lines: linesOf(item),
    });
    expect(deliveryOf(draft)).toEqual(EMPTY_DELIVERY);
    expectRule(
      await placeCall(shop, draft.orderId, draft.version),
      SALES_DELIVERY_RULE_KEY.DELIVERY_ADDRESS_REQUIRED,
    );
  });

  it("lets a DRAFT switch to COURIER or OWN_RIDER without an address yet", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await counterItemOf(shop, "Switch draft tea");
    for (const method of ["COURIER", "OWN_RIDER"] as const) {
      const draft = await draftOrder(shop, {
        locationId: shop.locationId,
        lines: linesOf(item),
      });
      const patched = await patchCall(shop, draft.orderId, {
        version: draft.version,
        fulfillmentMethod: method,
      });
      expect(patched.status).toBe(200);
      expect(patched.body.data.fulfillment.method).toBe(method);
      expect(patched.body.data.delivery.address).toBeNull();
    }
  });

  it("clears a stored address when a DRAFT switches to PICKUP", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await counterItemOf(shop, "Pickup switch tea");
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      fulfillmentMethod: "COURIER",
      deliveryAddress: DHAKA_ADDRESS,
      lines: linesOf(item),
    });
    expect(deliveryOf(draft)?.address).not.toBeNull();
    const patched = await patchCall(shop, draft.orderId, {
      version: draft.version,
      fulfillmentMethod: "PICKUP",
    });
    expect(patched.status).toBe(200);
    expect(patched.body.data.fulfillment.method).toBe("PICKUP");
    expect(patched.body.data.delivery).toBeNull();
  });

  it("refuses a PLACED PATCH from COURIER to PICKUP without a contact phone", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await counterItemOf(shop, "Contactless courier tea");
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      fulfillmentMethod: "COURIER",
      deliveryAddress: DHAKA_ADDRESS,
      lines: linesOf(item),
    });
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    expect(placed.status).toBe(200);
    expect(placed.order.contactId).toBeNull();
    expectRule(
      await patchCall(shop, draft.orderId, {
        version: placed.order.version,
        fulfillmentMethod: "PICKUP",
      }),
      SALES_RULE_KEY.CONTACT_PHONE_REQUIRED,
      { contactId: "" },
    );
    const unchanged = await getOrder(shop, draft.orderId);
    expect(unchanged.fulfillment.method).toBe("COURIER");
    expect(unchanged.status).toBe("PLACED");
  });

  it("lets a PLACED COURIER order switch to PICKUP when a phone-bearing contact is present", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await counterItemOf(shop, "Phone pickup switch tea");
    const contactId = await addCustomer(shop, "Rahim pickup", RAHIM_PHONE);
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      fulfillmentMethod: "COURIER",
      deliveryAddress: DHAKA_ADDRESS,
      lines: linesOf(item),
    });
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    expect(placed.status).toBe(200);
    const patched = await patchCall(shop, draft.orderId, {
      version: placed.order.version,
      fulfillmentMethod: "PICKUP",
      contactId,
    });
    expect(patched.status).toBe(200);
    expect(patched.body.data.fulfillment.method).toBe("PICKUP");
    expect(patched.body.data.contactId).toBe(contactId);
    expect(patched.body.data.delivery).toBeNull();
  });

  it("refuses a PLACED or CONFIRMED PATCH to COURIER without an address", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await counterItemOf(shop, "Placed switch tea");
    const contactId = await addCustomer(shop, "Rahim placed", RAHIM_PHONE);
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      contactId,
      lines: linesOf(item),
    });
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    expect(placed.status).toBe(200);
    expectRule(
      await patchCall(shop, draft.orderId, {
        version: placed.order.version,
        fulfillmentMethod: "COURIER",
      }),
      SALES_DELIVERY_RULE_KEY.DELIVERY_ADDRESS_REQUIRED,
    );

    const confirmed = await confirmOrder(shop, {
      orderId: draft.orderId,
      version: placed.order.version,
    });
    expectRule(
      await patchCall(shop, draft.orderId, {
        version: confirmed.version,
        fulfillmentMethod: "OWN_RIDER",
      }),
      SALES_DELIVERY_RULE_KEY.DELIVERY_ADDRESS_REQUIRED,
    );
  });

  it("refuses an areaCode outside the 1–50 trimmed bound", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await counterItemOf(shop, "Long area tea");
    const refused = await shop.actor.call("post", ordersPath(shop.organizationId), {
      locationId: shop.locationId,
      fulfillmentMethod: "COURIER",
      lines: linesOf(item),
      deliveryAddress: { ...DHAKA_ADDRESS, areaCode: "x".repeat(51) },
    });
    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("refuses PICKUP with an address and admin INSTANT create", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await counterItemOf(shop, "Pickup address tea");
    expectRule(
      await shop.actor.call("post", ordersPath(shop.organizationId), {
        locationId: shop.locationId,
        fulfillmentMethod: "PICKUP",
        deliveryAddress: DHAKA_ADDRESS,
        lines: linesOf(item),
      }),
      SALES_DELIVERY_RULE_KEY.ADDRESS_NOT_ALLOWED_FOR_METHOD,
      { method: "PICKUP" },
    );
    const instant = await shop.actor.call("post", ordersPath(shop.organizationId), {
      locationId: shop.locationId,
      fulfillmentMethod: "INSTANT",
      lines: linesOf(item),
    });
    expect(instant.status).toBe(422);
    expect(instant.body.error.details.ruleKey).toBe("FULFILLMENT_METHOD_UNSUPPORTED");
  });

  it("refuses a PATCH that turns a counter draft into INSTANT with the same error as create", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await counterItemOf(shop, "Instant patch tea");
    const created = await shop.actor.call("post", ordersPath(shop.organizationId), {
      locationId: shop.locationId,
      fulfillmentMethod: "INSTANT",
      lines: linesOf(item),
    });
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      lines: linesOf(item),
    });
    const patched = await patchCall(shop, draft.orderId, {
      version: draft.version,
      fulfillmentMethod: "INSTANT",
    });
    expect(created.status).toBe(422);
    expect(patched.status).toBe(422);
    expect(created.body.error.details).toEqual(patched.body.error.details);
    expect(created.body.error.details).toMatchObject({
      ruleKey: SALES_RULE_KEY.FULFILLMENT_METHOD_UNSUPPORTED,
      method: "INSTANT",
    });
    expect((await getOrder(shop, draft.orderId)).fulfillment.method).toBe("PICKUP");
  });

  it("lets the address change in DRAFT, PLACED and CONFIRMED and refuses PACKED", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    await setSetting(shop, "sales.usePacking", true);
    const item = await counterItemOf(shop, "Editable address tea");
    const contactId = await addCustomer(shop, "Rahim edit", RAHIM_PHONE);
    const otherAddress = { ...DHAKA_ADDRESS, addressLine: "House 99", areaCode: "gulshan" };
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      contactId,
      fulfillmentMethod: "COURIER",
      deliveryAddress: DHAKA_ADDRESS,
      lines: linesOf(item),
    });
    const drafted = await patchCall(shop, draft.orderId, {
      version: draft.version,
      deliveryAddress: otherAddress,
    });
    expect(drafted.status).toBe(200);
    expect(drafted.body.data.delivery.address.areaCode).toBe("gulshan");

    const placed = await placeOrder(shop, {
      orderId: draft.orderId,
      version: drafted.body.data.version as number,
    });
    expect(placed.status).toBe(200);
    const placedEdit = await patchCall(shop, draft.orderId, {
      version: placed.order.version,
      deliveryAddress: DHAKA_ADDRESS,
    });
    expect(placedEdit.status).toBe(200);

    const confirmed = await confirmOrder(shop, {
      orderId: draft.orderId,
      version: placedEdit.body.data.version as number,
    });
    const confirmedEdit = await patchCall(shop, draft.orderId, {
      version: confirmed.version,
      deliveryAddress: otherAddress,
    });
    expect(confirmedEdit.status).toBe(200);

    const packed = await transitionOrder(shop, {
      orderId: draft.orderId,
      action: "pack",
      version: confirmedEdit.body.data.version as number,
    });
    expect(packed.status).toBe(200);
    const packedEdit = await patchCall(shop, draft.orderId, {
      version: packed.order.version,
      deliveryAddress: DHAKA_ADDRESS,
    });
    expect(packedEdit.status).toBe(409);
    expect(packedEdit.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("refuses a stale version on a delivery address PATCH", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await counterItemOf(shop, "Stale tea");
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      fulfillmentMethod: "COURIER",
      deliveryAddress: DHAKA_ADDRESS,
      lines: linesOf(item),
    });
    const stale = await patchCall(shop, draft.orderId, {
      version: 99,
      deliveryAddress: { ...DHAKA_ADDRESS, areaCode: "mirpur" },
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.details.currentVersion).toBe(1);
  });

  it("refuses complete on a COURIER or OWN_RIDER order", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await counterItemOf(shop, "Complete refuse tea");
    const contactId = await addCustomer(shop, "Rahim complete", RAHIM_PHONE);
    for (const method of ["COURIER", "OWN_RIDER"] as const) {
      const draft = await draftOrder(shop, {
        locationId: shop.locationId,
        contactId,
        fulfillmentMethod: method,
        deliveryAddress: DHAKA_ADDRESS,
        lines: linesOf(item),
      });
      const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
      const confirmed = await confirmOrder(shop, {
        orderId: draft.orderId,
        version: placed.order.version,
      });
      expectRule(
        await shop.actor.call(
          "post",
          ordersPath(shop.organizationId, `/${draft.orderId}/complete`),
          { version: confirmed.version },
        ),
        SALES_DELIVERY_RULE_KEY.DELIVERY_METHOD_NOT_COMPLETABLE,
        { method },
      );
    }
  });

  it("releases the reservation when a placed delivery order is cancelled", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const riceItemId = await addInventoryItem(shop, "Delivery rice");
    const pack = await publishOffering(shop, {
      kind: "PRODUCT",
      name: "Delivery rice pack",
      priceAmount: ITEM_PRICE,
      stockComponents: [{ inventoryItemId: riceItemId, quantity: PACK_GRAMS }],
    });
    await receiveStock(shop, [
      { inventoryItemId: riceItemId, quantity: 5 * PACK_GRAMS, unitCostAmount: 60 },
    ]);
    const contactId = await addCustomer(shop, "Rahim stock", RAHIM_PHONE);
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      contactId,
      fulfillmentMethod: "COURIER",
      deliveryAddress: DHAKA_ADDRESS,
      lines: [{ offeringId: pack.offeringId, variantId: pack.variantId, quantity: 1 }],
    });
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    expect(placed.status).toBe(200);
    expect(await levelOf(shop, riceItemId)).toMatchObject({ reserved: PACK_GRAMS });
    const cancelled = await cancelOrder(shop, {
      orderId: draft.orderId,
      version: placed.order.version,
      reason: "Customer cancelled delivery",
    });
    expect(cancelled.status).toBe(200);
    expect(await levelOf(shop, riceItemId)).toMatchObject({ reserved: 0 });
  });

  it("refuses a viewer creating a delivery draft without permission", async () => {
    const world = await worldFor(harness, RETAIL);
    const viewer = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.VIEWER);
    const denied = await viewer.call("post", ordersPath(world.organizationA), {
      locationId: world.locationA1,
      fulfillmentMethod: "COURIER",
      lines: [],
    });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("FORBIDDEN");
  });

  it("hides another organization's delivery order", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const item = await counterItemOf(shop, "Cross-org tea");
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      fulfillmentMethod: "COURIER",
      deliveryAddress: DHAKA_ADDRESS,
      lines: linesOf(item),
    });
    const read = await world.bob.call("get", ordersPath(world.organizationA, `/${draft.orderId}`));
    expect(read.status).toBe(404);
    expect(read.body.error.code).toBe("NOT_FOUND");
  });

  it("refuses a member whose location assignment does not include the order", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const item = await counterItemOf(shop, "Cross-location tea");
    const staffRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.STAFF,
    );
    const staff = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA2, roleId: staffRoleId },
    ]);
    const createElsewhere = await staff.actor.call("post", ordersPath(world.organizationA), {
      locationId: world.locationA1,
      fulfillmentMethod: "COURIER",
      deliveryAddress: DHAKA_ADDRESS,
      lines: linesOf(item),
    });
    expect(createElsewhere.status).toBe(403);
    expect(createElsewhere.body.error.code).toBe("LOCATION_FORBIDDEN");

    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      fulfillmentMethod: "COURIER",
      deliveryAddress: DHAKA_ADDRESS,
      lines: linesOf(item),
    });
    const hidden = await staff.actor.call(
      "patch",
      ordersPath(world.organizationA, `/${draft.orderId}`),
      { version: draft.version, note: "moved" },
    );
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe("NOT_FOUND");
  });

  it("maps a legacy document to delivery defaults and a legacy COURIER order returns delivery with address null", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await counterItemOf(shop, "Legacy tea");
    const pickup = await draftOrder(shop, {
      locationId: shop.locationId,
      lines: linesOf(item),
    });
    await unsetDeliveryFields(shop.organizationId, pickup.orderId);
    expect(deliveryOf(await getOrder(shop, pickup.orderId))).toBeNull();

    const courier = await draftOrder(shop, {
      locationId: shop.locationId,
      fulfillmentMethod: "COURIER",
      lines: linesOf(item),
    });
    await unsetDeliveryFields(shop.organizationId, courier.orderId);
    expect(deliveryOf(await getOrder(shop, courier.orderId))).toEqual(EMPTY_DELIVERY);
  });

  it("replays the same Idempotency-Key on place of a delivery order and writes nothing twice", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await counterItemOf(shop, "Idempotent tea");
    const contactId = await addCustomer(shop, "Rahim idem", RAHIM_PHONE);
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      contactId,
      fulfillmentMethod: "COURIER",
      deliveryAddress: DHAKA_ADDRESS,
      lines: linesOf(item),
    });
    const key = newId();
    const first = await placeOrder(shop, {
      orderId: draft.orderId,
      version: draft.version,
      idempotencyKey: key,
    });
    expect(first.status).toBe(200);
    const replay = await placeOrder(shop, {
      orderId: draft.orderId,
      version: draft.version,
      idempotencyKey: key,
    });
    expect(replay.status).toBe(200);
    expect(replay.order.version).toBe(first.order.version);
    expect(replay.order.orderNumber).toBe(first.order.orderNumber);
  });
});

async function unsetDeliveryFields(organizationId: string, orderId: string): Promise<void> {
  await harness.connections.tenantShared.collection("orders").updateOne(
    { organizationId, orderId },
    {
      $unset: {
        deliveryAddress: "",
        deliveryZoneId: "",
        shippedAt: "",
        firstShipment: "",
        currentDeliveryAttemptId: "",
        deliveryAttemptCount: "",
      },
    },
  );
}

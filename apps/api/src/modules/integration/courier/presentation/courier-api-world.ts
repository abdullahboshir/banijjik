import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { newId } from "@banijjik/ids";
import { money, startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { OrderRow } from "../../../../test-support/sales-api-rows.js";
import {
  addCustomer,
  addInventoryItem,
  confirmOrder,
  draftOrder as baseDraftOrder,
  placeOrder,
  publishOffering,
  receiveStock,
  shopOf,
  type SalesShop,
} from "../../../../test-support/sales-api-world.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";

registerIamApiModels();

export const ITEM_PRICE = 5_000;
export const PACK_GRAMS = 1_000;
export const APPROVAL_PIN = "1234";

export const DHAKA_ADDRESS = {
  recipientName: "Rahim Courier",
  phoneE164: "01712345678",
  addressLine: "Road 1, Block A",
  districtCode: "dhaka",
  areaCode: "dhanmondi",
  postalCode: "1209",
} as const;

export interface TestOffering {
  readonly offeringId: string;
  readonly variantId: string;
  readonly inventoryItemId: string;
}

export async function createCourierProduct(
  shop: SalesShop,
  name: string,
): Promise<TestOffering> {
  const itemId = await addInventoryItem(shop, `${name} item`);
  await receiveStock(shop, [
    { inventoryItemId: itemId, quantity: 10 * PACK_GRAMS, unitCostAmount: 2_000 },
  ]);
  const off = await publishOffering(shop, {
    kind: "PRODUCT",
    name,
    priceAmount: ITEM_PRICE,
    stockComponents: [{ inventoryItemId: itemId, quantity: PACK_GRAMS }],
  });
  return { ...off, inventoryItemId: itemId };
}

let phoneSequence = 100000;

export async function ensureZone(shop: SalesShop): Promise<void> {
  await shop.actor.callWith({
    method: "post",
    path: `/orgs/${shop.organizationId}/sales/delivery-zones`,
    idempotencyKey: newId(),
    body: {
      zoneKey: `zone-${newId().slice(-8)}`,
      name: { bn: "ঢাকা", en: "Dhaka" },
      areaCodes: [DHAKA_ADDRESS.areaCode],
      feeMinor: 60,
      status: "ACTIVE",
    },
  });
}

export async function draftCourierOrder(
  shop: SalesShop,
  item: TestOffering,
): Promise<OrderRow> {
  await ensureZone(shop);
  const phone = `+88017${phoneSequence++}`;
  const contactId = await addCustomer(shop, "Customer", phone);
  return baseDraftOrder(shop, {
    locationId: shop.locationId,
    contactId,
    fulfillmentMethod: "COURIER",
    deliveryAddress: DHAKA_ADDRESS,
    lines: [{ offeringId: item.offeringId, variantId: item.variantId, quantity: 1 }],
  });
}

export async function confirmedCourierOrder(
  shop: SalesShop,
  item: TestOffering,
): Promise<OrderRow> {
  const drafted = await draftCourierOrder(shop, item);
  const placed = await placeOrder(shop, { orderId: drafted.orderId, version: drafted.version });
  return confirmOrder(shop, { orderId: drafted.orderId, version: placed.order.version });
}

export async function createDirectPayment(
  shop: SalesShop,
  orderId: string,
  amountMinor: number,
): Promise<string> {
  const response = await shop.actor.callWith({
    method: "post",
    path: `/orgs/${shop.organizationId}/payments`,
    idempotencyKey: newId(),
    body: {
      locationId: shop.locationId,
      method: "CASH",
      amount: money(amountMinor),
      allocations: [{ requestType: "ORDER", requestId: orderId, amount: money(amountMinor) }],
    },
  });
  return response.body.data.paymentId as string;
}

export async function grantSettlementReversalApproval(
  world: TwoOrganizations,
  courierSettlementId: string,
  locationId: string,
): Promise<string> {
  await world.alice.call("put", `/orgs/${world.organizationA}/me/approval-pin`, {
    currentPassword: world.alice.person.password,
    pin: APPROVAL_PIN,
  });
  const approvers = await world.alice.call(
    "get",
    `/orgs/${world.organizationA}/approvers?locationId=${locationId}`,
  );
  const granted = await world.alice.call("post", `/orgs/${world.organizationA}/approvals`, {
    action: APPROVAL_ACTION.COURIER_SETTLEMENT_REVERSAL,
    subjectKey: courierSettlementId,
    locationId,
    approverMemberId: approvers.body.data[0].memberId,
    pin: APPROVAL_PIN,
  });
  return granted.body.data.approvalToken as string;
}

export { startCatalogApi, worldFor, shopOf };

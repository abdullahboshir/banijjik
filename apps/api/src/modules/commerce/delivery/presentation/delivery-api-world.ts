import { ALL_LOCATIONS, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { newId } from "@banijjik/ids";
import { money, startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId, type AddedMember } from "../../../../test-support/rbac-world.js";
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
export {
  addCustomer,
  addInventoryItem,
  confirmOrder,
  baseDraftOrder,
  placeOrder,
  publishOffering,
  receiveStock,
  shopOf,
  type SalesShop,
};
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";

registerIamApiModels();

export const ITEM_PRICE = 5_000;
export const PACK_GRAMS = 1_000;
export const APPROVAL_PIN = "1234";

export const DHAKA_ADDRESS = {
  recipientName: "Rahim Delivery",
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

export async function createDeliveryProduct(
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

let phoneSequence = 200000;

export async function ensureDeliveryZone(shop: SalesShop): Promise<void> {
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

export async function draftRiderOrder(
  shop: SalesShop,
  item: TestOffering,
): Promise<OrderRow> {
  await ensureDeliveryZone(shop);
  const phone = `+88017${phoneSequence++}`;
  const contactId = await addCustomer(shop, "Customer", phone);
  return baseDraftOrder(shop, {
    locationId: shop.locationId,
    contactId,
    fulfillmentMethod: "OWN_RIDER",
    deliveryAddress: DHAKA_ADDRESS,
    lines: [{ offeringId: item.offeringId, variantId: item.variantId, quantity: 1 }],
  });
}

export async function confirmedRiderOrder(
  shop: SalesShop,
  item: TestOffering,
): Promise<OrderRow> {
  const drafted = await draftRiderOrder(shop, item);
  const placed = await placeOrder(shop, { orderId: drafted.orderId, version: drafted.version });
  return confirmOrder(shop, { orderId: drafted.orderId, version: placed.order.version });
}

export async function createRiderMember(
  harness: { readonly app: import("express").Express; readonly connections: unknown },
  world: TwoOrganizations,
  locationId: string = ALL_LOCATIONS,
): Promise<AddedMember> {
  const roleId = await findSystemRoleId(harness.connections as never, world.organizationA, SYSTEM_ROLE_KEY.STAFF);
  return addMemberWithAssignments(harness.app, world.organizationA, [
    { locationId, roleId },
  ]);
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

export async function grantHandoverReversalApproval(
  world: TwoOrganizations,
  riderCashHandoverId: string,
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
    action: APPROVAL_ACTION.RIDER_HANDOVER_REVERSAL,
    subjectKey: riderCashHandoverId,
    locationId,
    approverMemberId: approvers.body.data[0].memberId,
    pin: APPROVAL_PIN,
  });
  return granted.body.data.approvalToken as string;
}

export { startCatalogApi, worldFor };

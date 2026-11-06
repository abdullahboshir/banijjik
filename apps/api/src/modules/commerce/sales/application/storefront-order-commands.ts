import {
  ERROR_CODE,
  OFFERING_KIND,
} from "@banijjik/contracts";
import { ORDER_SOURCE } from "@banijjik/contracts/sales";
import type { DeliveryAddress } from "@banijjik/contracts/sales/delivery";
import type {
  CheckoutFulfillment,
  CheckoutRecipientSnapshot,
  CheckoutRequestLink,
  CheckoutSelection,
  PublicOrderCommands,
  StorefrontCommandContext,
} from "@banijjik/contracts/website";
import {
  asId,
  newId,
  type ContactId,
  type LocationId,
  type OrderId,
  type OrganizationId,
} from "@banijjik/ids";
import { AppError } from "../../../../kernel/http/index.js";
import { businessDateOf } from "../domain/business-date.js";
import { orderNeedsLine, recordNotFound } from "../domain/errors.js";
import { Order } from "../domain/order.entity.js";
import type { SalesDependencies } from "./sales-dependencies.js";
import { quoteAndPrepare } from "./sales-quote-lines.js";
import {
  assertAddressAllowedForMethod,
  isDeliveryFulfillment,
} from "./sales-transition-shared.js";
import type { OrderLineInput, PreparedLines } from "./sales-line-preparation.js";
import { executePlaceTransaction } from "./storefront-order-execution.js";

function extractLineInputs(selections: readonly CheckoutSelection[]): OrderLineInput[] {
  const productSelections = selections.filter((sel) => sel.selection.kind === "PRODUCT");
  if (productSelections.length === 0) {
    throw orderNeedsLine();
  }
  return productSelections.map((sel) => {
    if (sel.selection.kind !== "PRODUCT") {
      throw new Error("Invalid selection kind");
    }
    return {
      offeringId: sel.selection.offeringId,
      variantId: sel.selection.variantId,
      quantity: sel.selection.quantity,
      modifierOptionIds: [...sel.selection.modifierOptionIds],
    };
  });
}

function mappedCheckoutAddress(fulfillment: CheckoutFulfillment): DeliveryAddress | null {
  if (fulfillment.address === undefined) return null;
  return {
    recipientName: fulfillment.address.recipientName,
    phoneE164: fulfillment.address.phone,
    addressLine: fulfillment.address.addressLine,
    districtCode: fulfillment.address.districtCode,
    areaCode: fulfillment.address.areaCode,
    postalCode: fulfillment.address.postalCode ?? null,
  };
}

function deliveryAddressOf(fulfillment: CheckoutFulfillment): DeliveryAddress | null {
  if (!isDeliveryFulfillment(fulfillment.method)) return null;
  return mappedCheckoutAddress(fulfillment);
}

function assertStorefrontPlaceReady(
  prepared: PreparedLines,
  fulfillment: CheckoutFulfillment,
): void {
  if (prepared.lines.length === 0) throw orderNeedsLine();
  assertAddressAllowedForMethod(fulfillment.method, mappedCheckoutAddress(fulfillment));
}

function assertExpectedDeliveryCharge(
  prepared: PreparedLines,
  expectedDeliveryChargeMinor: number,
): void {
  if (prepared.totals.deliveryCharge.amount === expectedDeliveryChargeMinor) return;
  throw new AppError({
    code: ERROR_CODE.CHECKOUT_PRICE_CHANGED,
    messageKey: "errors.checkout_price_changed",
  });
}

function createStorefrontDraft(params: {
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly contactId: ContactId;
  readonly checkoutId: string;
  readonly recipient: CheckoutRecipientSnapshot;
  readonly fulfillment: CheckoutFulfillment;
  readonly prepared: PreparedLines;
  readonly now: Date;
  readonly timeZone: string;
}): Order {
  return Order.createDraft({
    orderId: newId<OrderId>(),
    organizationId: params.organizationId,
    locationId: params.locationId,
    contactId: params.contactId,
    fulfillment: { method: params.fulfillment.method },
    deliveryAddress: deliveryAddressOf(params.fulfillment),
    deliveryZoneId: params.prepared.deliveryZoneId,
    lines: params.prepared.lines,
    totals: params.prepared.totals,
    businessDate: businessDateOf(params.now, params.timeZone),
    source: ORDER_SOURCE.STOREFRONT,
    note: null,
    orderDiscount: null,
    customFields: {},
    hasStockLines: params.prepared.trackedLines.length > 0,
    posSessionId: null,
    checkoutId: params.checkoutId,
    recipient: {
      name: params.recipient.name,
      phoneE164: params.recipient.phoneE164,
    },
    createdByUserId: null,
    now: params.now,
  });
}

interface PlaceCommandInput {
  readonly selections: readonly CheckoutSelection[];
  readonly recipient: CheckoutRecipientSnapshot;
  readonly fulfillment: CheckoutFulfillment;
  readonly expectedDeliveryChargeMinor: number;
}

async function handlePlaceStorefrontOrder(
  dependencies: SalesDependencies,
  context: StorefrontCommandContext,
  input: PlaceCommandInput,
): Promise<CheckoutRequestLink> {
  const organizationId = asId<OrganizationId>(context.organizationId);
  const locationId = asId<LocationId>(context.locationId);
  const contactId = asId<ContactId>(context.contactId);

  const effectiveKinds = await dependencies.kinds.effectiveKinds(organizationId);
  if (!effectiveKinds.includes(OFFERING_KIND.PRODUCT)) {
    throw recordNotFound();
  }

  const lineInputs = extractLineInputs(input.selections);
  const now = dependencies.clock.now();
  const timeZone = await dependencies.timeZone.read(organizationId);

  const prepared = await quoteAndPrepare(dependencies, {
    allowedKinds: [OFFERING_KIND.PRODUCT],
    organizationId,
    locationId,
    lines: lineInputs,
    delivery: {
      method: input.fulfillment.method,
      address: deliveryAddressOf(input.fulfillment),
    },
  });
  assertStorefrontPlaceReady(prepared, input.fulfillment);
  assertExpectedDeliveryCharge(prepared, input.expectedDeliveryChargeMinor);

  const draft = createStorefrontDraft({
    organizationId,
    locationId,
    contactId,
    checkoutId: context.checkoutId,
    recipient: input.recipient,
    fulfillment: input.fulfillment,
    prepared,
    now,
    timeZone,
  });

  const placedOrder = await executePlaceTransaction({
    dependencies,
    organizationId,
    locationId,
    contactId,
    draft,
    prepared,
    now,
    timeZone,
  });

  return {
    selectionIds: input.selections.map((s) => s.selectionId),
    requestType: "ORDER",
    requestId: placedOrder.orderId,
    publicNumber: placedOrder.orderNumber,
    status: placedOrder.status,
    paymentRequired: placedOrder.totals.grandTotal,
    holdExpiresAt: null,
  };
}

export function buildStorefrontOrderCommands(dependencies: SalesDependencies): PublicOrderCommands {
  return {
    place: (context, input) => handlePlaceStorefrontOrder(dependencies, context, input),
  };
}

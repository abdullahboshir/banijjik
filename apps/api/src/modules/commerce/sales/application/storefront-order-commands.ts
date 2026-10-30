import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  LIMIT_KEY,
  OFFERING_KIND,
  SEQUENCE_KEY,
} from "@banijjik/contracts";
import {
  ORDER_SOURCE,
  SALES_ADVANCE_REQUIRED,
  SALES_EVENT_TYPE,
  type FulfillmentMethod,
} from "@banijjik/contracts/sales";
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
import { nextSequenceValue } from "../../../../kernel/sequence/index.js";
import { businessDateOf, businessMonthKeyOf } from "../domain/business-date.js";
import { orderNeedsLine, recordNotFound } from "../domain/errors.js";
import { Order } from "../domain/order.entity.js";
import type { SalesDependencies } from "./sales-dependencies.js";
import { quoteAndPrepare } from "./sales-quote-lines.js";
import { formatOrderNumber, orderOrderingKey, stockInputOf } from "./sales-transition-shared.js";
import type { OrderLineInput, PreparedLines } from "./sales-line-preparation.js";

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

interface PlaceExecutionParams {
  readonly dependencies: SalesDependencies;
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly contactId: ContactId;
  readonly draft: Order;
  readonly prepared: PreparedLines;
  readonly now: Date;
  readonly timeZone: string;
}

interface ReserveStockParams {
  readonly dependencies: SalesDependencies;
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly orderId: OrderId;
  readonly lines: PreparedLines["trackedLines"];
  readonly allowNegativeStock: boolean;
}

async function reserveStock(params: ReserveStockParams): Promise<void> {
  if (params.lines.length === 0) return;
  await params.dependencies.stock.reserve(
    stockInputOf({
      organizationId: params.organizationId,
      locationId: params.locationId,
      actorUserId: null,
      orderId: params.orderId,
      lines: params.lines,
      allowNegativeStock: params.allowNegativeStock,
    }),
  );
}

async function handleAutoConfirmation(
  dependencies: SalesDependencies,
  transitioned: Order,
  now: Date,
): Promise<Order> {
  const confirmed = transitioned.confirm({ actorUserId: null, now });
  await dependencies.orders.update(confirmed, transitioned.version);
  await dependencies.events.publish(
    SALES_EVENT_TYPE.ORDER_CONFIRMED,
    { orderId: confirmed.orderId },
    { orderingKey: orderOrderingKey(confirmed.orderId) },
  );
  await dependencies.audit.record({
    action: AUDIT_ACTION.ORDER_CONFIRMED,
    entityType: AUDIT_ENTITY_TYPE.order,
    entityId: confirmed.orderId,
    changes: {},
  });
  return confirmed;
}

async function executePlaceTransaction(params: PlaceExecutionParams): Promise<Order> {
  const { dependencies, organizationId, locationId, contactId, draft, prepared, now, timeZone } =
    params;
  const settings = await dependencies.settings.read(organizationId);

  return dependencies.unitOfWork.run(async () => {
    const counted = (await dependencies.counter.increment(businessMonthKeyOf(now, timeZone))) - 1;
    await dependencies.limits.assertBelow(LIMIT_KEY.ORDERS_PER_MONTH, counted);

    const orderNumber = formatOrderNumber(
      await nextSequenceValue({
        organizationId,
        sequenceKey: SEQUENCE_KEY.ORDER,
      }),
    );

    await reserveStock({
      dependencies,
      organizationId,
      locationId,
      orderId: draft.orderId,
      lines: prepared.trackedLines,
      allowNegativeStock: settings.allowNegativeStock,
    });

    const transitioned = draft.place({
      orderNumber,
      contactId,
      lines: prepared.lines,
      totals: prepared.totals,
      approval: null,
      hasStockLines: prepared.trackedLines.length > 0,
      actor: { actorUserId: null, now },
    });

    await dependencies.orders.insert(transitioned);

    await dependencies.payments.initializeSummary({
      organizationId,
      orderId: transitioned.orderId,
      contactId: transitioned.contactId,
      locationId: transitioned.locationId,
      total: transitioned.totals.grandTotal,
      now,
    });

    await dependencies.events.publish(
      SALES_EVENT_TYPE.ORDER_PLACED,
      { orderId: transitioned.orderId },
      { orderingKey: orderOrderingKey(transitioned.orderId) },
    );

    await dependencies.audit.record({
      action: AUDIT_ACTION.ORDER_PLACED,
      entityType: AUDIT_ENTITY_TYPE.order,
      entityId: transitioned.orderId,
      changes: { orderNumber: { to: transitioned.orderNumber } },
    });

    if (settings.autoConfirm && settings.advanceRequired === SALES_ADVANCE_REQUIRED.NONE) {
      return handleAutoConfirmation(dependencies, transitioned, now);
    }

    return transitioned;
  });
}

function createStorefrontDraft(params: {
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly contactId: ContactId;
  readonly checkoutId: string;
  readonly recipient: CheckoutRecipientSnapshot;
  readonly fulfillmentMethod: FulfillmentMethod;
  readonly prepared: PreparedLines;
  readonly now: Date;
  readonly timeZone: string;
}): Order {
  return Order.createDraft({
    orderId: newId<OrderId>(),
    organizationId: params.organizationId,
    locationId: params.locationId,
    contactId: params.contactId,
    fulfillment: { method: params.fulfillmentMethod },
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
  });

  if (prepared.lines.length === 0) {
    throw orderNeedsLine();
  }

  const draft = createStorefrontDraft({
    organizationId,
    locationId,
    contactId,
    checkoutId: context.checkoutId,
    recipient: input.recipient,
    fulfillmentMethod: input.fulfillment.method,
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

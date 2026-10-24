import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import type { CurrencyCode } from "@banijjik/contracts";
import type { ManualDiscount } from "@banijjik/contracts/pricing";
import {
  FULFILLMENT_METHOD,
  ORDER_SOURCE,
  SALES_EVENT_TYPE,
  type FulfillmentMethod,
  type OrderResponse,
  type OrderTotals,
} from "@banijjik/contracts/sales";
import {
  asId,
  newId,
  type ContactId,
  type LocationId,
  type OrderId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import { recordNotFound } from "../../domain/errors.js";
import { businessDateOf } from "../../domain/business-date.js";
import { Order } from "../../domain/order.entity.js";
import type { SalesDependencies } from "../sales-dependencies.js";
import type { OrderLineInput, PreparedLines } from "../sales-line-preparation.js";
import { quoteAndPrepare } from "../sales-quote-lines.js";
import {
  assertLocationAllowed,
  orderOrderingKey,
  resolveFulfillmentMethod,
} from "../sales-transition-shared.js";
import { toOrderResponse } from "../sales-views.js";

/** The totals of a draft with no lines yet, in the organization currency. */
export function emptyTotalsOf(currency: CurrencyCode): OrderTotals {
  const zero = { amount: 0, currency };
  return {
    subtotal: zero,
    discountTotal: zero,
    taxTotal: zero,
    deliveryCharge: zero,
    grandTotal: zero,
    roundingAdjustment: zero,
  };
}

/** The inputs an edit replays into the quoter, recovered from the stored lines. */
export function lineInputsOf(order: Order): OrderLineInput[] {
  return order.lines.map((line) => ({
    offeringId: line.offeringId,
    variantId: line.variantId,
    quantity: line.quantity,
    modifierOptionIds: line.modifiers.map((modifier) => modifier.modifierOptionId),
    ...(line.manualDiscount === null ? {} : { manualDiscount: line.manualDiscount }),
    performedByMemberId: line.performedByMemberId,
  }));
}

export async function assertActiveContact(
  dependencies: SalesDependencies,
  contactId: ContactId | null,
): Promise<void> {
  if (contactId === null) return;
  const contact = await dependencies.contacts.findActive(contactId);
  if (contact === undefined) throw recordNotFound();
}

export interface OrderWriteInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId | null;
  readonly allowedLocationIds: readonly string[] | "ALL";
}

export interface OrderBodyBase {
  readonly locationId: string;
  readonly contactId?: string | undefined;
  readonly orderDiscount?: ManualDiscount | undefined;
  readonly fulfillmentMethod?: FulfillmentMethod | undefined;
  readonly note?: string | null | undefined;
  readonly customFields?: Readonly<Record<string, unknown>> | undefined;
  readonly approvalToken?: string | undefined;
}

/** A DRAFT: no number, no stock effect; lines are optional and quoted when present. */
type CreateOrderInput = OrderWriteInput & {
  readonly body: OrderBodyBase & { readonly lines: readonly OrderLineInput[] };
};

export class CreateOrderUseCase {
  constructor(private readonly dependencies: SalesDependencies) {}

  async execute(input: CreateOrderInput): Promise<OrderResponse> {
    assertLocationAllowed(input.body.locationId, input.allowedLocationIds);
    const contactId =
      input.body.contactId === undefined ? null : asId<ContactId>(input.body.contactId);
    await assertActiveContact(this.dependencies, contactId);
    const order = await this.draftOf(input, contactId);
    await this.persistDraft(order);
    return toOrderResponse(order, await this.dependencies.payments.readTotals(order.orderId));
  }

  private async draftOf(input: CreateOrderInput, contactId: ContactId | null): Promise<Order> {
    const now = this.dependencies.clock.now();
    const timeZone = await this.dependencies.timeZone.read(input.organizationId);
    const prepared = await this.quoteBody(input);
    const totals =
      prepared?.totals ??
      emptyTotalsOf(await this.dependencies.currency.read(input.organizationId));
    return Order.createDraft({
      orderId: newId<OrderId>(),
      organizationId: input.organizationId,
      locationId: asId<LocationId>(input.body.locationId),
      contactId,
      fulfillment: {
        method: resolveFulfillmentMethod(input.body.fulfillmentMethod, FULFILLMENT_METHOD.PICKUP),
      },
      lines: prepared?.lines ?? [],
      totals,
      businessDate: businessDateOf(now, timeZone),
      source: ORDER_SOURCE.ADMIN,
      note: input.body.note ?? null,
      orderDiscount: input.body.orderDiscount ?? null,
      customFields: input.body.customFields ?? {},
      hasStockLines: prepared !== undefined && prepared.trackedLines.length > 0,
      createdByUserId: input.actorUserId,
      now,
    });
  }

  private async quoteBody(input: CreateOrderInput): Promise<PreparedLines | undefined> {
    if (input.body.lines.length === 0) return undefined;
    return quoteAndPrepare(this.dependencies, {
      organizationId: input.organizationId,
      locationId: input.body.locationId,
      lines: input.body.lines,
      orderDiscount: input.body.orderDiscount,
    });
  }

  private async persistDraft(order: Order): Promise<void> {
    await this.dependencies.unitOfWork.run(async () => {
      await this.dependencies.orders.insert(order);
      await this.dependencies.events.publish(
        SALES_EVENT_TYPE.ORDER_DRAFTED,
        { orderId: order.orderId },
        { orderingKey: orderOrderingKey(order.orderId) },
      );
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.ORDER_DRAFTED,
        entityType: AUDIT_ENTITY_TYPE.order,
        entityId: order.orderId,
        changes: {},
      });
    });
  }
}

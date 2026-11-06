import {
  FULFILLMENT_METHOD,
  ORDER_CANCELLABLE_STATUSES,
  ORDER_EDITABLE_STATUSES,
  ORDER_STATUS,
  type FulfillmentMethod,
  type Money,
  type OrderApproval,
  type OrderStatus,
} from "@banijjik/contracts/sales";
import type { FirstShipmentPostingFacts } from "@banijjik/contracts/sales/delivery";
import {
  assertDeliveryDispatch,
  assertDeliveryFulfillable,
  assertNotDelivery,
  assertStatus,
  cleared,
  draftOrderProps,
  lineKey,
  returnStatusOfLines,
  type NewOrderInput,
  type OrderContentChanges,
  type OrderLineProps,
  type OrderProps,
  type OrderTransitionActor,
} from "./order-types.js";

/**
 * One sale, from a draft without a number to a completed order with a frozen quote (09 §5.5).
 * Money never changes here: every figure is the quote result the application passes in.
 */
export class Order implements OrderProps {
  readonly orderId: OrderProps["orderId"];
  readonly organizationId: OrderProps["organizationId"];
  readonly orderNumber: string | null;
  readonly invoiceNumber: string | null;
  readonly locationId: OrderProps["locationId"];
  readonly contactId: OrderProps["contactId"];
  readonly status: OrderStatus;
  readonly lines: readonly OrderLineProps[];
  readonly totals: OrderProps["totals"];
  readonly fulfillment: OrderProps["fulfillment"];
  readonly deliveryAddress: OrderProps["deliveryAddress"];
  readonly deliveryZoneId: OrderProps["deliveryZoneId"];
  readonly shippedAt: OrderProps["shippedAt"];
  readonly deliveredAt: OrderProps["deliveredAt"];
  readonly firstShipment: OrderProps["firstShipment"];
  readonly currentDeliveryAttemptId: OrderProps["currentDeliveryAttemptId"];
  readonly deliveryAttemptCount: OrderProps["deliveryAttemptCount"];
  readonly businessDate: string;
  readonly source: OrderProps["source"];
  readonly approval: OrderApproval | null;
  readonly note: string | null;
  readonly orderDiscount: OrderProps["orderDiscount"];
  readonly cancelReason: string | null;
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly posSessionId: OrderProps["posSessionId"];
  readonly checkoutId: OrderProps["checkoutId"];
  readonly recipient: OrderProps["recipient"];
  readonly hasStockLines: boolean;
  readonly returnStatus: OrderProps["returnStatus"];
  readonly completedAt: OrderProps["completedAt"];
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: OrderProps["createdByUserId"];
  readonly updatedByUserId: OrderProps["updatedByUserId"];

  private constructor(props: OrderProps) {
    this.orderId = props.orderId;
    this.organizationId = props.organizationId;
    this.orderNumber = props.orderNumber;
    this.invoiceNumber = props.invoiceNumber;
    this.locationId = props.locationId;
    this.contactId = props.contactId;
    this.status = props.status;
    this.lines = props.lines;
    this.totals = props.totals;
    this.fulfillment = props.fulfillment;
    this.deliveryAddress = props.deliveryAddress;
    this.deliveryZoneId = props.deliveryZoneId;
    this.shippedAt = props.shippedAt;
    this.deliveredAt = props.deliveredAt ?? null;
    this.firstShipment = props.firstShipment;
    this.currentDeliveryAttemptId = props.currentDeliveryAttemptId;
    this.deliveryAttemptCount = props.deliveryAttemptCount;
    this.businessDate = props.businessDate;
    this.source = props.source;
    this.approval = props.approval;
    this.note = props.note;
    this.orderDiscount = props.orderDiscount;
    this.cancelReason = props.cancelReason;
    this.customFields = props.customFields;
    this.posSessionId = props.posSessionId;
    this.checkoutId = props.checkoutId ?? null;
    this.recipient = props.recipient ?? null;
    this.hasStockLines = props.hasStockLines;
    this.returnStatus = props.returnStatus;
    this.completedAt = props.completedAt;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
    this.updatedByUserId = props.updatedByUserId;
  }

  static createDraft(input: NewOrderInput): Order {
    return new Order(draftOrderProps(input));
  }

  static restore(props: OrderProps): Order {
    return new Order(props);
  }

  toProps(): OrderProps {
    return { ...this };
  }

  assertEditable(): void {
    assertStatus(this.status, ORDER_EDITABLE_STATUSES);
  }

  applyEdit(changes: OrderContentChanges, actor: OrderTransitionActor): Order {
    this.assertEditable();
    const isPickup =
      changes.fulfillment?.method === FULFILLMENT_METHOD.PICKUP ||
      changes.fulfillment?.method === FULFILLMENT_METHOD.INSTANT;
    return new Order({
      ...this,
      contactId: cleared(changes.contactId, this.contactId),
      note: cleared(changes.note, this.note),
      orderDiscount: cleared(changes.orderDiscount, this.orderDiscount),
      lines: changes.lines ?? this.lines,
      totals: changes.totals ?? this.totals,
      fulfillment: changes.fulfillment ?? this.fulfillment,
      deliveryAddress: isPickup ? null : cleared(changes.deliveryAddress, this.deliveryAddress),
      deliveryZoneId: isPickup ? null : cleared(changes.deliveryZoneId, this.deliveryZoneId),
      approval: this.approval,
      hasStockLines: changes.hasStockLines ?? this.hasStockLines,
      updatedAt: actor.now,
      updatedByUserId: actor.actorUserId,
    });
  }

  place(input: {
    readonly orderNumber: string;
    readonly contactId: OrderProps["contactId"];
    readonly lines: readonly OrderLineProps[];
    readonly totals: OrderProps["totals"];
    readonly approval: OrderApproval | null;
    readonly hasStockLines: boolean;
    readonly deliveryZoneId?: string | null;
    readonly actor: OrderTransitionActor;
  }): Order {
    assertStatus(this.status, [ORDER_STATUS.DRAFT]);
    assertDeliveryFulfillable(this);
    return new Order({
      ...this,
      orderNumber: input.orderNumber,
      contactId: input.contactId,
      lines: input.lines,
      totals: input.totals,
      deliveryZoneId: input.deliveryZoneId === undefined ? this.deliveryZoneId : input.deliveryZoneId,
      approval: input.approval,
      hasStockLines: input.hasStockLines,
      status: ORDER_STATUS.PLACED,
      updatedAt: input.actor.now,
      updatedByUserId: input.actor.actorUserId,
    });
  }

  confirm(actor: OrderTransitionActor): Order {
    assertStatus(this.status, [ORDER_STATUS.PLACED]);
    return this.moved(ORDER_STATUS.CONFIRMED, actor);
  }

  pack(actor: OrderTransitionActor): Order {
    assertStatus(this.status, [ORDER_STATUS.CONFIRMED]);
    return this.moved(ORDER_STATUS.PACKED, actor);
  }

  ship(input: {
    readonly attemptId: string;
    readonly dispatchMethod: FulfillmentMethod;
    readonly firstShipment: FirstShipmentPostingFacts;
    readonly actor: OrderTransitionActor;
  }): Order {
    assertStatus(this.status, [ORDER_STATUS.CONFIRMED, ORDER_STATUS.PACKED]);
    assertDeliveryDispatch(this, input.dispatchMethod);
    return new Order({
      ...this,
      status: ORDER_STATUS.SHIPPED,
      shippedAt: this.shippedAt ?? input.actor.now,
      firstShipment: this.firstShipment ?? input.firstShipment,
      currentDeliveryAttemptId: input.attemptId,
      deliveryAttemptCount: this.deliveryAttemptCount + 1,
      updatedAt: input.actor.now,
      updatedByUserId: input.actor.actorUserId,
    });
  }

  failDelivery(actor: OrderTransitionActor): Order {
    assertStatus(this.status, [ORDER_STATUS.SHIPPED]);
    return this.moved(ORDER_STATUS.DELIVERY_FAILED, actor);
  }

  deliver(actor: OrderTransitionActor): Order {
    assertStatus(this.status, [ORDER_STATUS.SHIPPED]);
    return new Order({
      ...this,
      status: ORDER_STATUS.DELIVERED,
      deliveredAt: this.deliveredAt ?? actor.now,
      updatedAt: actor.now,
      updatedByUserId: actor.actorUserId,
    });
  }

  receiveRts(actor: OrderTransitionActor): Order {
    assertStatus(this.status, [ORDER_STATUS.DELIVERY_FAILED]);
    return this.moved(ORDER_STATUS.RETURNED_TO_SENDER, actor);
  }

  reship(input: {
    readonly attemptId: string;
    readonly dispatchMethod: FulfillmentMethod;
    readonly actor: OrderTransitionActor;
  }): Order {
    assertStatus(this.status, [ORDER_STATUS.DELIVERY_FAILED]);
    assertDeliveryDispatch(this, input.dispatchMethod);
    return new Order({
      ...this,
      status: ORDER_STATUS.SHIPPED,
      currentDeliveryAttemptId: input.attemptId,
      deliveryAttemptCount: this.deliveryAttemptCount + 1,
      updatedAt: input.actor.now,
      updatedByUserId: input.actor.actorUserId,
    });
  }

  complete(input: {
    readonly invoiceNumber: string;
    readonly unitCosts: ReadonlyMap<string, Money | null>;
    readonly actor: OrderTransitionActor;
  }): Order {
    assertStatus(this.status, [ORDER_STATUS.CONFIRMED, ORDER_STATUS.PACKED]);
    assertNotDelivery(this.fulfillment.method);
    return this.completedWith(input);
  }

  completeInstant(input: {
    readonly invoiceNumber: string;
    readonly unitCosts: ReadonlyMap<string, Money | null>;
    readonly actor: OrderTransitionActor;
  }): Order {
    assertStatus(this.status, [ORDER_STATUS.PLACED]);
    return this.completedWith(input);
  }

  private completedWith(input: {
    readonly invoiceNumber: string;
    readonly unitCosts: ReadonlyMap<string, Money | null>;
    readonly actor: OrderTransitionActor;
  }): Order {
    return new Order({
      ...this,
      invoiceNumber: input.invoiceNumber,
      completedAt: input.actor.now,
      lines: this.lines.map((line) => ({
        ...line,
        unitCostSnapshot: input.unitCosts.get(lineKey(line)) ?? null,
      })),
      status: ORDER_STATUS.COMPLETED,
      updatedAt: input.actor.now,
      updatedByUserId: input.actor.actorUserId,
    });
  }

  cancel(input: { readonly reason: string; readonly actor: OrderTransitionActor }): Order {
    assertStatus(this.status, ORDER_CANCELLABLE_STATUSES);
    return new Order({
      ...this,
      status: ORDER_STATUS.CANCELLED,
      cancelReason: input.reason,
      updatedAt: input.actor.now,
      updatedByUserId: input.actor.actorUserId,
    });
  }

  recordReturn(input: {
    readonly lines: readonly OrderLineProps[];
    readonly actor: OrderTransitionActor;
  }): Order {
    assertStatus(this.status, [ORDER_STATUS.COMPLETED, ORDER_STATUS.DELIVERED]);
    return new Order({
      ...this,
      lines: input.lines,
      returnStatus: returnStatusOfLines(input.lines),
      updatedAt: input.actor.now,
      updatedByUserId: input.actor.actorUserId,
    });
  }

  private moved(status: OrderStatus, actor: OrderTransitionActor): Order {
    return new Order({
      ...this,
      status,
      updatedAt: actor.now,
      updatedByUserId: actor.actorUserId,
    });
  }
}
export { lineKey, returnStatusOfLines };

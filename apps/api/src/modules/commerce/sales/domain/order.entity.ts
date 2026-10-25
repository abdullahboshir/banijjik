import {
  ORDER_CANCELLABLE_STATUSES,
  ORDER_EDITABLE_STATUSES,
  ORDER_RETURN_STATUS,
  ORDER_STATUS,
  type Money,
  type OrderApproval,
  type OrderStatus,
} from "@banijjik/contracts/sales";
import { invalidTransition } from "./errors.js";
import type {
  NewOrderInput,
  OrderContentChanges,
  OrderLineProps,
  OrderProps,
  OrderTransitionActor,
} from "./order-types.js";

const INITIAL_VERSION = 1;

/** `null` clears an optional value, `undefined` keeps it. */
function cleared<Value>(change: Value | null | undefined, current: Value | null): Value | null {
  if (change === undefined) return current;
  return change;
}

function assertStatus(status: OrderStatus, allowed: readonly OrderStatus[]): void {
  if (!allowed.includes(status)) throw invalidTransition(status);
}

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
  readonly businessDate: string;
  readonly source: OrderProps["source"];
  readonly approval: OrderApproval | null;
  readonly note: string | null;
  readonly orderDiscount: OrderProps["orderDiscount"];
  readonly cancelReason: string | null;
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly posSessionId: OrderProps["posSessionId"];
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
    this.businessDate = props.businessDate;
    this.source = props.source;
    this.approval = props.approval;
    this.note = props.note;
    this.orderDiscount = props.orderDiscount;
    this.cancelReason = props.cancelReason;
    this.customFields = props.customFields;
    this.posSessionId = props.posSessionId;
    this.hasStockLines = props.hasStockLines;
    this.returnStatus = props.returnStatus;
    this.completedAt = props.completedAt;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
    this.updatedByUserId = props.updatedByUserId;
  }

  /** A DRAFT: no number, no invoice and no stock effect yet. */
  static createDraft(input: NewOrderInput): Order {
    return new Order({
      orderId: input.orderId,
      organizationId: input.organizationId,
      orderNumber: null,
      invoiceNumber: null,
      locationId: input.locationId,
      contactId: input.contactId,
      status: ORDER_STATUS.DRAFT,
      lines: input.lines,
      totals: input.totals,
      fulfillment: input.fulfillment,
      businessDate: input.businessDate,
      source: input.source,
      approval: null,
      note: input.note,
      orderDiscount: input.orderDiscount,
      cancelReason: null,
      customFields: input.customFields,
      posSessionId: input.posSessionId,
      hasStockLines: input.hasStockLines,
      returnStatus: ORDER_RETURN_STATUS.NONE,
      completedAt: null,
      version: INITIAL_VERSION,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.createdByUserId,
      updatedByUserId: input.createdByUserId,
    });
  }

  static restore(props: OrderProps): Order {
    return new Order(props);
  }

  toProps(): OrderProps {
    return {
      orderId: this.orderId,
      organizationId: this.organizationId,
      orderNumber: this.orderNumber,
      invoiceNumber: this.invoiceNumber,
      locationId: this.locationId,
      contactId: this.contactId,
      status: this.status,
      lines: this.lines,
      totals: this.totals,
      fulfillment: this.fulfillment,
      businessDate: this.businessDate,
      source: this.source,
      approval: this.approval,
      note: this.note,
      orderDiscount: this.orderDiscount,
      cancelReason: this.cancelReason,
      customFields: this.customFields,
      posSessionId: this.posSessionId,
      hasStockLines: this.hasStockLines,
      returnStatus: this.returnStatus,
      completedAt: this.completedAt,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdByUserId: this.createdByUserId,
      updatedByUserId: this.updatedByUserId,
    };
  }

  /** DRAFT, PLACED and CONFIRMED may be edited; a completed or cancelled order never changes. */
  assertEditable(): void {
    assertStatus(this.status, ORDER_EDITABLE_STATUSES);
  }

  /** PATCH: the caller has already re-quoted; this only replaces the stored content. */
  applyEdit(
    changes: OrderContentChanges & { readonly approval?: OrderApproval | null },
    actor: OrderTransitionActor,
  ): Order {
    this.assertEditable();
    return new Order({
      ...this,
      contactId: cleared(changes.contactId, this.contactId),
      lines: changes.lines ?? this.lines,
      totals: changes.totals ?? this.totals,
      orderDiscount: cleared(changes.orderDiscount, this.orderDiscount),
      note: cleared(changes.note, this.note),
      customFields: changes.customFields ?? this.customFields,
      approval: cleared(changes.approval, this.approval),
      hasStockLines: changes.hasStockLines ?? this.hasStockLines,
      updatedAt: actor.now,
      updatedByUserId: actor.actorUserId,
    });
  }

  /** DRAFT becomes PLACED with its number and the freshly quoted content. */
  place(input: {
    readonly orderNumber: string;
    readonly contactId: OrderProps["contactId"];
    readonly lines: readonly OrderLineProps[];
    readonly totals: OrderProps["totals"];
    readonly approval: OrderApproval | null;
    readonly hasStockLines: boolean;
    readonly actor: OrderTransitionActor;
  }): Order {
    assertStatus(this.status, [ORDER_STATUS.DRAFT]);
    return new Order({
      ...this,
      orderNumber: input.orderNumber,
      contactId: input.contactId,
      lines: input.lines,
      totals: input.totals,
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

  /**
   * CONFIRMED or PACKED becomes COMPLETED: the invoice number arrives and every line receives the
   * average cost read by the inventory module at this moment.
   */
  complete(input: {
    readonly invoiceNumber: string;
    readonly unitCosts: ReadonlyMap<string, Money | null>;
    readonly actor: OrderTransitionActor;
  }): Order {
    assertStatus(this.status, [ORDER_STATUS.CONFIRMED, ORDER_STATUS.PACKED]);
    return this.completedWith(input);
  }

  /**
   * The instant path: a PLACED order completes straight away, without confirm or pack
   * (ADR-131). Only the instant sale reaches COMPLETED from PLACED.
   */
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

  /** DRAFT, PLACED, CONFIRMED and PACKED may be cancelled; the caller releases the reservation. */
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

  /**
   * A return on a COMPLETED order: the caller has checked the quantities and computed the lines'
   * new returned quantities. Only the lines and the return status change; money lives in the
   * return and the payment summary (plan 3.5b decision 7).
   */
  recordReturn(input: {
    readonly lines: readonly OrderLineProps[];
    readonly actor: OrderTransitionActor;
  }): Order {
    assertStatus(this.status, [ORDER_STATUS.COMPLETED]);
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

/** NONE before any return, FULL once every unit of every line came back, PARTIAL otherwise. */
export function returnStatusOfLines(lines: readonly OrderLineProps[]): OrderProps["returnStatus"] {
  const returned = lines.reduce((total, line) => total + line.returnedQuantity, 0);
  if (returned === 0) return ORDER_RETURN_STATUS.NONE;
  const everyLineFull = lines.every((line) => line.returnedQuantity >= line.quantity);
  return everyLineFull ? ORDER_RETURN_STATUS.FULL : ORDER_RETURN_STATUS.PARTIAL;
}

export function lineKey(line: { readonly offeringId: string; readonly variantId: string }): string {
  return `${line.offeringId}:${line.variantId}`;
}

import type {
  FulfillmentMethod,
  OrderSource,
  OrderStatus,
  PaymentStatus,
  SalesCancelReason,
} from "@banijjik/contracts/sales";
import type { ContactLinkLabels } from "@banijjik/ui";

export interface OrderListLabels {
  readonly title: string;
  readonly subtitle: string;
  readonly newOrder: string;
  readonly empty: string;
  readonly search: string;
  readonly searchPlaceholder: string;
  readonly statusFilter: string;
  readonly statusAll: string;
  readonly locationFilter: string;
  readonly locationAll: string;
  readonly apply: string;
  readonly reset: string;
  readonly previous: string;
  readonly next: string;
  readonly page: string;
  readonly number: string;
  readonly contact: string;
  readonly date: string;
  readonly total: string;
  readonly payment: string;
  readonly unnumbered: string;
  readonly open: string;
}

export interface OrderDetailLabels {
  readonly back: string;
  readonly titleFallback: string;
  readonly invoice: string;
  readonly noInvoice: string;
  readonly location: string;
  readonly contact: string;
  readonly noContact: string;
  readonly fulfillment: string;
  readonly source: string;
  readonly note: string;
  readonly created: string;
  readonly updated: string;
  readonly lines: string;
  readonly emptyLines: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly lineDiscount: string;
  readonly lineTotal: string;
  readonly modifiers: string;
  readonly subtotal: string;
  readonly discount: string;
  readonly tax: string;
  readonly delivery: string;
  readonly rounding: string;
  readonly total: string;
  readonly due: string;
  readonly paymentStatus: string;
  readonly receivePayment: string;
  readonly payment: string;
  readonly summary: string;
  readonly totals: string;
  readonly history: string;
  readonly historyEmpty: string;
  readonly actionsTitle: string;
  readonly deleteDescription: string;
}

export interface OrderActionLabels {
  readonly edit: string;
  readonly place: string;
  readonly confirm: string;
  readonly pack: string;
  readonly complete: string;
  readonly cancel: string;
  readonly deleteDraft: string;
  readonly receivePayment: string;
  readonly close: string;
  readonly save: string;
}

export interface OrderCancelLabels {
  readonly title: string;
  readonly description: string;
  readonly storeCredit: string;
  readonly reason: string;
  readonly reasonPlaceholder: string;
  readonly reasonRequired: string;
  readonly pickContact: string;
  readonly submit: string;
  readonly keep: string;
  readonly success: string;
}

export interface OrderNewLabels {
  readonly title: string;
  readonly subtitle: string;
  readonly back: string;
  readonly location: string;
  readonly locationRequired: string;
  readonly fulfillment: string;
  readonly contact: string;
  readonly contactHint: string;
  readonly note: string;
  readonly orderDiscount: string;
  readonly lines: string;
  readonly addLine: string;
  readonly emptyLines: string;
  readonly saveDraft: string;
  readonly place: string;
  readonly complete: string;
  readonly draftSaved: string;
  readonly placed: string;
  readonly completed: string;
  readonly failed: string;
  readonly noLinesToPlace: string;
  readonly invalidLine: string;
  readonly openDraft: string;
}

export interface OrderLineLabels {
  readonly product: string;
  /** The "Done by" select of a line (plan 3.11 Refresh C). */
  readonly performer: string;
  readonly performerNone: string;
  readonly performerLoadFailed: string;
  readonly performerUnknown: string;
  readonly searchPlaceholder: string;
  readonly searching: string;
  readonly noResults: string;
  readonly searchFailed: string;
  readonly loadFailed: string;
  readonly change: string;
  readonly variant: string;
  readonly none: string;
  readonly quantity: string;
  readonly quantityRule: string;
  readonly modifiers: string;
  readonly required: string;
  readonly discount: string;
  readonly discountNone: string;
  readonly discountPercent: string;
  readonly discountAmount: string;
  readonly discountValue: string;
  readonly unitPrice: string;
  readonly quantityInvalid: string;
  readonly discountInvalid: string;
  readonly remove: string;
}

export interface OrderQuoteLabels {
  readonly title: string;
  readonly subtotal: string;
  readonly discount: string;
  readonly tax: string;
  readonly total: string;
  readonly rounding: string;
  readonly calculating: string;
  readonly failed: string;
  readonly approvalRequired: string;
  readonly lineDiscount: string;
  readonly lineTax: string;
}

export interface OrderApprovalLabels {
  readonly title: string;
  readonly approver: string;
  readonly pin: string;
  readonly submit: string;
  readonly cancel: string;
  readonly close: string;
  readonly locked: string;
  readonly failed: string;
  readonly loadFailed: string;
  readonly noApprovers: string;
}

export interface OrderContactLabels extends ContactLinkLabels {
  readonly phoneInvalid: string;
  readonly createFailed: string;
}

export interface OrderEditLabels {
  readonly title: string;
  readonly subtitle: string;
  readonly save: string;
  readonly success: string;
  readonly close: string;
  readonly noLines: string;
}

export interface OrderHistoryLabels {
  readonly title: string;
  readonly empty: string;
  readonly system: string;
  readonly actions: Readonly<Record<string, string>>;
}

export interface OrderLabels {
  readonly list: OrderListLabels;
  readonly detail: OrderDetailLabels;
  readonly actions: OrderActionLabels;
  readonly cancelDialog: OrderCancelLabels;
  readonly newOrder: OrderNewLabels;
  readonly line: OrderLineLabels;
  readonly quote: OrderQuoteLabels;
  readonly approval: OrderApprovalLabels;
  readonly contact: OrderContactLabels;
  readonly edit: OrderEditLabels;
  readonly history: OrderHistoryLabels;
  readonly status: Readonly<Record<OrderStatus, string>>;
  readonly paymentStatus: Readonly<Record<PaymentStatus, string>>;
  readonly fulfillment: Readonly<Record<FulfillmentMethod, string>>;
  readonly source: Readonly<Record<OrderSource, string>>;
  readonly cancelReason: Readonly<Record<SalesCancelReason, string>>;
}

import type { CurrencyCode } from "@banijjik/contracts";
import type { ManualDiscount } from "@banijjik/contracts/pricing";
import {
  INSTANT_ORDER_APPROVAL_SUBJECT,
  orderApprovalSubject,
  type FulfillmentMethod,
} from "@banijjik/contracts/sales";
import { toast, type ContactLinkValue } from "@banijjik/ui";
import type { OrderCreateBody, OrderLineInputBody } from "@banijjik/validation/sales";
import { createOrder, instantOrder, placeOrder, quoteOrder } from "./order-api";
import type { OrderApprovalFlow } from "./order-approval";
import type { OrderLabels } from "./order-labels";
import {
  manualDiscountTotalOf,
  quoteLinesOf,
  type DiscountTypeChoice,
  type OrderLineDraft,
} from "./order-lines";

export interface NewOrderValues {
  readonly locationId: string;
  readonly fulfillment: FulfillmentMethod;
  readonly contact: ContactLinkValue | null;
  readonly lines: readonly OrderLineDraft[];
  readonly discountType: DiscountTypeChoice;
  readonly discountText: string;
  readonly note: string;
}

export interface CreatedOrder {
  readonly orderId: string;
  readonly version: number;
}

/** Everything one submit needs; the flows below never touch React state themselves. */
export interface SubmitContext {
  readonly organizationId: string;
  readonly currency: CurrencyCode;
  readonly labels: OrderLabels;
  readonly values: NewOrderValues;
  readonly lineInputs: readonly OrderLineInputBody[];
  readonly orderDiscount: ManualDiscount | undefined;
  readonly contactId: string | undefined;
  readonly createdOrder: CreatedOrder | undefined;
  readonly approval: OrderApprovalFlow;
  readonly rememberDraft: (draft: CreatedOrder) => void;
  readonly openOrder: (orderId: string) => void;
}

function createBodyOf(context: SubmitContext): OrderCreateBody {
  const { values, contactId, orderDiscount } = context;
  return {
    locationId: values.locationId,
    lines: [...context.lineInputs],
    fulfillmentMethod: values.fulfillment,
    note: values.note.trim(),
    ...(contactId === undefined ? {} : { contactId }),
    ...(orderDiscount === undefined ? {} : { orderDiscount }),
  };
}

/** The manual discount the approver signs off, from a fresh quote of the lines on screen. */
async function approvalAmountOf(context: SubmitContext): Promise<number> {
  const quote = await quoteOrder(context.organizationId, {
    locationId: context.values.locationId,
    lines: quoteLinesOf(context.lineInputs),
    ...(context.orderDiscount === undefined ? {} : { orderDiscount: context.orderDiscount }),
  });
  return manualDiscountTotalOf(quote);
}

async function ensureDraft(context: SubmitContext): Promise<CreatedOrder> {
  if (context.createdOrder !== undefined) return context.createdOrder;
  const order = await createOrder(context.organizationId, createBodyOf(context));
  const draft = { orderId: order.orderId, version: order.version };
  context.rememberDraft(draft);
  return draft;
}

export async function saveNewDraft(context: SubmitContext): Promise<void> {
  const draft = await ensureDraft(context);
  toast.success(context.labels.newOrder.draftSaved);
  context.openOrder(draft.orderId);
}

export async function placeNewOrder(context: SubmitContext): Promise<void> {
  const amount = await approvalAmountOf(context);
  const draft = await ensureDraft(context);
  await context.approval.attempt(
    {
      subjectKey: orderApprovalSubject(draft.orderId),
      locationId: context.values.locationId,
      amount: { amount, currency: context.currency },
    },
    async (approvalToken) => {
      await placeOrder(context.organizationId, draft.orderId, {
        version: draft.version,
        ...(approvalToken === undefined ? {} : { approvalToken }),
      });
    },
    () => {
      toast.success(context.labels.newOrder.placed);
      context.openOrder(draft.orderId);
    },
  );
}

/** The instant sale: the order is created and completed in one request (the POS building block). */
export async function completeInstantOrder(context: SubmitContext): Promise<void> {
  const amount = await approvalAmountOf(context);
  const completed: { orderId?: string } = {};
  await context.approval.attempt(
    {
      subjectKey: INSTANT_ORDER_APPROVAL_SUBJECT,
      locationId: context.values.locationId,
      amount: { amount, currency: context.currency },
    },
    async (approvalToken) => {
      const order = await instantOrder(context.organizationId, {
        ...createBodyOf(context),
        ...(approvalToken === undefined ? {} : { approvalToken }),
      });
      completed.orderId = order.orderId;
    },
    () => {
      toast.success(context.labels.newOrder.completed);
      if (completed.orderId !== undefined) context.openOrder(completed.orderId);
    },
  );
}

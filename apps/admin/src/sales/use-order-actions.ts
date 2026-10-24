"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import { orderApprovalSubject, type OrderResponse } from "@banijjik/contracts/sales";
import { useTranslator } from "@banijjik/web-client/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { failureOf, type RuleFailure } from "./order-failure";
import {
  completeOrder,
  confirmOrder,
  deleteDraft,
  packOrder,
  placeOrder,
  quoteOrder,
} from "./order-api";
import { useOrderApprovalFlow, type OrderApprovalFlow } from "./order-approval";
import type { OrderApprovalLabels } from "./order-labels";
import { manualDiscountTotalOf, quoteLinesOf, storedLineInputs } from "./order-lines";

export interface UseOrderActionsInput {
  readonly orgSlug: string;
  readonly organizationId: string;
  readonly order: OrderResponse;
  readonly currency: CurrencyCode;
  readonly approvalLabels: OrderApprovalLabels;
}

export interface OrderActions {
  readonly isSaving: boolean;
  readonly failure: RuleFailure | undefined;
  readonly approval: OrderApprovalFlow;
  readonly reportFailure: (error: unknown) => void;
  readonly place: () => Promise<void>;
  readonly confirm: () => Promise<void>;
  readonly pack: () => Promise<void>;
  readonly complete: () => Promise<void>;
  readonly remove: () => Promise<void>;
}

/** The manual discount the draft carries; the approver signs off exactly this amount. */
async function manualDiscountOfDraft(
  organizationId: string,
  order: OrderResponse,
): Promise<number> {
  const inputs = storedLineInputs(order);
  if (inputs.length === 0) return 0;
  const quote = await quoteOrder(organizationId, {
    locationId: order.locationId,
    lines: quoteLinesOf(inputs),
    ...(order.orderDiscount === null ? {} : { orderDiscount: order.orderDiscount }),
  });
  return manualDiscountTotalOf(quote);
}

interface PlaceDraftInput extends UseOrderActionsInput {
  readonly approval: OrderApprovalFlow;
  readonly onPlaced: () => void;
}

/** Places the draft; a manual discount over the limit opens the approval dialog and retries. */
async function placeDraft(input: PlaceDraftInput): Promise<void> {
  const { organizationId, order } = input;
  const amount = await manualDiscountOfDraft(organizationId, order);
  const request = {
    subjectKey: orderApprovalSubject(order.orderId),
    locationId: order.locationId,
    amount: { amount, currency: input.currency },
  };
  await input.approval.attempt(
    request,
    async (approvalToken) => {
      await placeOrder(organizationId, order.orderId, {
        version: order.version,
        ...(approvalToken === undefined ? {} : { approvalToken }),
      });
    },
    input.onPlaced,
  );
}

export function useOrderActions(input: UseOrderActionsInput): OrderActions {
  const { t } = useTranslator();
  const router = useRouter();
  const { organizationId, order } = input;
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<RuleFailure | undefined>();
  const reportFailure = (error: unknown): void => setFailure(failureOf(error, t));
  const approval = useOrderApprovalFlow({
    organizationId,
    labels: input.approvalLabels,
    onFailure: reportFailure,
  });

  async function guarded(action: () => Promise<void>): Promise<void> {
    setIsSaving(true);
    setFailure(undefined);
    try {
      await action();
    } catch (error) {
      reportFailure(error);
    } finally {
      setIsSaving(false);
    }
  }

  const transition = (send: typeof confirmOrder) => async (): Promise<void> =>
    guarded(async () => {
      await send(organizationId, order.orderId, { version: order.version });
      router.refresh();
    });

  const place = async (): Promise<void> =>
    guarded(() => placeDraft({ ...input, approval, onPlaced: () => router.refresh() }));

  async function remove(): Promise<void> {
    await guarded(async () => {
      await deleteDraft(organizationId, order.orderId, order.version);
      router.push(`/${input.orgSlug}/orders`);
      router.refresh();
    });
  }

  return {
    isSaving,
    failure,
    approval,
    reportFailure,
    place,
    confirm: transition(confirmOrder),
    pack: transition(packOrder),
    complete: transition(completeOrder),
    remove,
  };
}

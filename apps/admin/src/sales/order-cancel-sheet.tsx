"use client";

import { SALES_RULE_KEY, type OrderResponse } from "@banijjik/contracts/sales";
import { Button, FormField, Sheet, SheetContent, Textarea } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { cancelOrder } from "./order-api";
import { failureOf, type RuleFailure } from "./order-failure";
import type { OrderLabels } from "./order-labels";
import { showSuccessToast } from "./order-toast";

export interface OrderCancelSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly organizationId: string;
  readonly order: OrderResponse;
  readonly hasNetPaid: boolean;
  readonly canEdit: boolean;
  readonly labels: OrderLabels;
  readonly onPickContact: () => void;
  readonly onFailure: (failure: RuleFailure) => void;
}

interface CancelState {
  readonly reason: string;
  readonly error: string | undefined;
  readonly needsContact: boolean;
  readonly isSaving: boolean;
}

const INITIAL_STATE: CancelState = {
  reason: "",
  error: undefined,
  needsContact: false,
  isSaving: false,
};

interface CancelFieldsProps extends OrderCancelSheetProps {
  readonly state: CancelState;
  readonly onReasonChange: (reason: string) => void;
  readonly onSubmit: () => void;
}

function CancelFields(props: CancelFieldsProps): ReactElement {
  const { labels, state } = props;
  return (
    <>
      {props.hasNetPaid ? (
        <p className="text-body text-warning">{labels.cancelDialog.storeCredit}</p>
      ) : null}
      <FormField
        label={labels.cancelDialog.reason}
        htmlFor="order-cancel-reason"
        required
        {...(state.error === undefined ? {} : { error: state.error })}
      >
        <Textarea
          id="order-cancel-reason"
          placeholder={labels.cancelDialog.reasonPlaceholder}
          value={state.reason}
          disabled={state.isSaving}
          onChange={(event) => props.onReasonChange(event.target.value)}
        />
      </FormField>
      {state.needsContact ? (
        <Button variant="secondary" disabled={!props.canEdit} onClick={props.onPickContact}>
          {labels.cancelDialog.pickContact}
        </Button>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          disabled={state.isSaving}
          onClick={() => props.onOpenChange(false)}
        >
          {labels.cancelDialog.keep}
        </Button>
        <Button variant="danger" isLoading={state.isSaving} onClick={() => props.onSubmit()}>
          {labels.cancelDialog.submit}
        </Button>
      </div>
    </>
  );
}

/** Cancelling asks for a reason; a paid order's net amount goes to the customer's store credit. */
export function OrderCancelSheet(props: OrderCancelSheetProps): ReactElement {
  const { t } = useTranslator();
  const router = useRouter();
  const { labels } = props;
  const [state, setState] = useState<CancelState>(INITIAL_STATE);

  async function submit(): Promise<void> {
    const reason = state.reason.trim();
    if (reason === "") {
      setState({ ...state, error: labels.cancelDialog.reasonRequired });
      return;
    }
    setState({ ...state, error: undefined, isSaving: true });
    try {
      await cancelOrder(props.organizationId, props.order.orderId, {
        version: props.order.version,
        reason,
      });
      props.onOpenChange(false);
      void showSuccessToast(labels.cancelDialog.success);
      router.refresh();
    } catch (error) {
      const failure = failureOf(error, t);
      const needsContact = failure.ruleKey === SALES_RULE_KEY.ORDER_CANCEL_NEEDS_CONTACT;
      if (needsContact) props.onFailure(failure);
      setState({ ...state, error: failure.message, needsContact, isSaving: false });
      return;
    }
    setState({ ...state, isSaving: false });
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        title={labels.cancelDialog.title}
        description={labels.cancelDialog.description}
        closeLabel={labels.cancelDialog.keep}
      >
        <CancelFields
          {...props}
          state={state}
          onReasonChange={(reason) => setState({ ...state, reason })}
          onSubmit={() => void submit()}
        />
      </SheetContent>
    </Sheet>
  );
}

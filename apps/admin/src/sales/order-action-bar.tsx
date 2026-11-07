"use client";

import { SALES_RULE_KEY } from "@banijjik/contracts/sales";
import { Button, PageSection } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { OrderActionFlags } from "./order-action-flags";
import type { OrderLabels } from "./order-labels";
import type { OrderActions } from "./use-order-actions";

export interface OrderActionBarProps {
  readonly flags: OrderActionFlags;
  readonly actions: OrderActions;
  readonly labels: OrderLabels;
  readonly canReceive: boolean;
  readonly remainingDue: boolean;
  readonly onEdit: () => void;
  readonly onCancel: () => void;
  readonly onDelete: () => void;
  readonly onReceivePayment: () => void;
  /** The "Return" action of a completed order inside the return window (plan 3.5b card B). */
  readonly returnAvailable: boolean;
  readonly returnLabel: string;
  readonly onReturn: () => void;
  /** The "Exchange items" action beside "Return" (plan 3.5b B2). */
  readonly exchangeAvailable: boolean;
  readonly exchangeLabel: string;
  readonly onExchange: () => void;
  readonly onShip?: () => void;
  readonly onFailAttempt?: () => void;
  readonly onReship?: () => void;
  readonly onRts?: () => void;
  readonly onReconcileLoss?: () => void;
  readonly onRecoverLoss?: () => void;
}

function TransitionButtons(props: OrderActionBarProps): ReactElement {
  const { flags, actions, labels } = props;
  return (
    <>
      {flags.canPlace ? (
        <Button isLoading={actions.isSaving} onClick={() => void actions.place()}>
          {labels.actions.place}
        </Button>
      ) : null}
      {flags.canConfirm ? (
        <Button isLoading={actions.isSaving} onClick={() => void actions.confirm()}>
          {labels.actions.confirm}
        </Button>
      ) : null}
      {flags.canPack ? (
        <Button isLoading={actions.isSaving} onClick={() => void actions.pack()}>
          {labels.actions.pack}
        </Button>
      ) : null}
      {flags.canComplete ? (
        <Button isLoading={actions.isSaving} onClick={() => void actions.complete()}>
          {labels.actions.complete}
        </Button>
      ) : null}
      {flags.canShip && props.onShip ? (
        <Button isLoading={actions.isSaving} onClick={props.onShip}>
          {labels.actions.ship}
        </Button>
      ) : null}
      {flags.canFailAttempt && props.onFailAttempt ? (
        <Button variant="secondary" disabled={actions.isSaving} onClick={props.onFailAttempt}>
          {labels.actions.failAttempt}
        </Button>
      ) : null}
      {flags.canReship && props.onReship ? (
        <Button isLoading={actions.isSaving} onClick={props.onReship}>
          {labels.actions.reship}
        </Button>
      ) : null}
      {flags.canRts && props.onRts ? (
        <Button variant="secondary" disabled={actions.isSaving} onClick={props.onRts}>
          {labels.actions.rts}
        </Button>
      ) : null}
      {flags.canReconcileLoss && props.onReconcileLoss ? (
        <Button variant="danger" disabled={actions.isSaving} onClick={props.onReconcileLoss}>
          {labels.actions.reconcileLoss}
        </Button>
      ) : null}
      {flags.canRecoverLoss && props.onRecoverLoss ? (
        <Button variant="secondary" disabled={actions.isSaving} onClick={props.onRecoverLoss}>
          {labels.actions.recoverLoss}
        </Button>
      ) : null}
    </>
  );
}

function SecondaryButtons(props: OrderActionBarProps): ReactElement {
  const { flags, actions, labels } = props;
  return (
    <>
      {props.returnAvailable ? (
        <Button variant="secondary" disabled={actions.isSaving} onClick={props.onReturn}>
          {props.returnLabel}
        </Button>
      ) : null}
      {props.exchangeAvailable ? (
        <Button variant="secondary" disabled={actions.isSaving} onClick={props.onExchange}>
          {props.exchangeLabel}
        </Button>
      ) : null}
      {flags.canEdit ? (
        <Button variant="secondary" disabled={actions.isSaving} onClick={props.onEdit}>
          {labels.actions.edit}
        </Button>
      ) : null}
      {flags.canCancel ? (
        <Button variant="secondary" disabled={actions.isSaving} onClick={props.onCancel}>
          {labels.actions.cancel}
        </Button>
      ) : null}
      {flags.canDeleteDraft ? (
        <Button variant="danger" disabled={actions.isSaving} onClick={props.onDelete}>
          {labels.actions.deleteDraft}
        </Button>
      ) : null}
    </>
  );
}

function FailureNotice(props: OrderActionBarProps): ReactElement | null {
  const { failure } = props.actions;
  if (failure === undefined) return null;
  const needsAdvance = failure.ruleKey === SALES_RULE_KEY.ADVANCE_NEEDS_PAYMENTS;
  const needsContact = failure.ruleKey === SALES_RULE_KEY.ORDER_CANCEL_NEEDS_CONTACT;
  return (
    <div className="flex flex-col gap-2">
      <p role="alert" className="text-body text-danger">
        {failure.message}
      </p>
      {needsAdvance && props.canReceive && props.remainingDue ? (
        <Button variant="secondary" onClick={props.onReceivePayment}>
          {props.labels.detail.receivePayment}
        </Button>
      ) : null}
      {needsContact && props.flags.canEdit ? (
        <Button variant="secondary" onClick={props.onEdit}>
          {props.labels.cancelDialog.pickContact}
        </Button>
      ) : null}
    </div>
  );
}

/** The status actions the staff member may take, and the refusal that follows a failed one. */
export function OrderActionBar(props: OrderActionBarProps): ReactElement | null {
  const hasSecondary = props.returnAvailable || props.exchangeAvailable;
  if (!props.flags.hasActions && !hasSecondary) return null;
  return (
    <PageSection title={props.labels.detail.actionsTitle}>
      <div className="flex flex-wrap gap-2">
        <SecondaryButtons {...props} />
        <TransitionButtons {...props} />
      </div>
      <FailureNotice {...props} />
    </PageSection>
  );
}

"use client";

import { Button, formatMoney, type DisplayLocale } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useState, type ReactElement } from "react";
import { CancelDialogLazy } from "./cancel-dialog-lazy";
import { ENROLLMENT_ACTION_KEY, type EnrollmentActionKey } from "./enrollment-action-items";
import {
  useEnrollmentActions,
  type CancelOutcome,
  type EnrollmentActionFailure,
} from "./use-enrollment-actions";

export interface EnrollmentActionLabels {
  readonly actions: Readonly<Record<EnrollmentActionKey, string>>;
  readonly payHint: string;
  readonly conflict: string;
  readonly reload: string;
  readonly cancelTitle: string;
  readonly cancelDescription: string;
  readonly cancelConfirm: string;
  readonly cancelKeep: string;
  readonly cancelClose: string;
  readonly cancelDone: string;
  readonly refundable: string;
  readonly refundablePeriods: string;
  /** The period name by its id, so the cancel result can name each refundable period. */
  readonly periodNames: Readonly<Record<string, string>>;
  readonly refundLater: string;
}

export interface EnrollmentDetailActionsProps {
  readonly organizationId: string;
  readonly enrollmentId: string;
  readonly version: number;
  readonly actions: readonly EnrollmentActionKey[];
  readonly locale: DisplayLocale;
  readonly labels: EnrollmentActionLabels;
}

function CancelResult(props: {
  outcome: CancelOutcome;
  locale: DisplayLocale;
  labels: EnrollmentActionLabels;
  onClose: () => void;
}): ReactElement {
  const { outcome, labels } = props;
  const refundableRows = outcome.refundableByPeriod.filter((row) => row.amount.amount > 0);
  return (
    <div role="status" className="flex flex-col gap-2 rounded-lg border border-default p-4">
      <p className="text-body font-semibold text-primary">{labels.cancelDone}</p>
      {outcome.refundableAmount ? (
        <p className="text-body text-primary">
          {labels.refundable}: {formatMoney(outcome.refundableAmount, { locale: props.locale })}
        </p>
      ) : null}
      {refundableRows.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-small font-semibold text-secondary">{labels.refundablePeriods}</p>
          <ul className="flex flex-col gap-1">
            {refundableRows.map((row) => (
              <li
                key={row.enrollmentPeriodId}
                className="flex justify-between gap-3 text-small text-primary"
              >
                <span>{labels.periodNames[row.enrollmentPeriodId] ?? row.enrollmentPeriodId}</span>
                <span>{formatMoney(row.amount, { locale: props.locale })}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-small text-secondary">{labels.refundLater}</p>
      <Button type="button" onClick={props.onClose}>
        {labels.cancelClose}
      </Button>
    </div>
  );
}

function FailureNote(props: {
  failure: EnrollmentActionFailure;
  labels: EnrollmentActionLabels;
  onReload: () => void;
}): ReactElement {
  const { t } = useTranslator();
  const { failure, labels } = props;
  return (
    <div role="alert" className="flex flex-col gap-1 text-small text-danger">
      <p>{failure.isConflict ? labels.conflict : t(failure.messageKey)}</p>
      {failure.isConflict ? (
        <Button type="button" variant="secondary" onClick={props.onReload}>
          {labels.reload}
        </Button>
      ) : null}
      {failure.isPaymentRequired ? <p>{labels.payHint}</p> : null}
    </div>
  );
}

export function EnrollmentDetailActions(props: EnrollmentDetailActionsProps): ReactElement | null {
  const { labels } = props;
  const [isConfirming, setIsConfirming] = useState(false);
  const state = useEnrollmentActions(props);
  if (state.cancelOutcome) {
    return (
      <CancelResult
        outcome={state.cancelOutcome}
        locale={props.locale}
        labels={labels}
        onClose={state.reload}
      />
    );
  }
  if (props.actions.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {props.actions.map((action) => (
          <Button
            key={action}
            type="button"
            variant={action === ENROLLMENT_ACTION_KEY.CANCEL ? "secondary" : "primary"}
            disabled={state.isBusy}
            onClick={() =>
              action === ENROLLMENT_ACTION_KEY.CANCEL
                ? setIsConfirming(true)
                : void state.run(action)
            }
          >
            {labels.actions[action]}
          </Button>
        ))}
      </div>
      {state.failure ? (
        <FailureNote failure={state.failure} labels={labels} onReload={state.reload} />
      ) : null}
      {isConfirming ? (
        <CancelDialogLazy
          title={labels.cancelTitle}
          description={labels.cancelDescription}
          confirmLabel={labels.cancelConfirm}
          keepLabel={labels.cancelKeep}
          closeLabel={labels.cancelClose}
          onOpenChange={setIsConfirming}
          onConfirm={() => {
            setIsConfirming(false);
            void state.run(ENROLLMENT_ACTION_KEY.CANCEL);
          }}
        />
      ) : null}
    </div>
  );
}

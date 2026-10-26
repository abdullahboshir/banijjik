"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { ModifierGroupResponse } from "@banijjik/contracts/catalog";
import type { PaymentMethod } from "@banijjik/contracts/payment";
import {
  SALES_EXCHANGE_PAYMENT_METHODS,
  type OrderResponse,
  type SalesExchangeResponse,
} from "@banijjik/contracts/sales";
import { Button, Sheet, SheetContent, type DisplayLocale } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useState, type ReactElement } from "react";
import { ExchangePaymentStep } from "./exchange-payment-step";
import {
  blockerInputOf,
  blockerMessageOf,
  stepAfter,
  stepBefore,
  stepBlockerOf,
  stepTitleOf,
} from "./exchange-step-rules";
import { exchangeLabelsOf, type ExchangeLabels } from "./exchange-labels";
import { ExchangeResult } from "./exchange-result";
import { exchangeBlockerOf, exchangeMethodsFor, type ExchangeBlocker } from "./exchange-model";
import { ExchangeNewLinesStep, ExchangeReturnStep } from "./exchange-steps";
import { LazyOrderApprovalDialog } from "./lazy-order-approval-dialog";
import type { OrderLabels } from "./order-labels";
import type { ReturnLabels } from "./return-labels";
import {
  EXCHANGE_STEP,
  useExchangeForm,
  useExchangeSubmit,
  type ExchangeFormActions,
  type ExchangeFormState,
  type ExchangeSubmitState,
} from "./use-exchange-sheet";
import {
  readyPreviewOf,
  useExchangePreview,
  type ExchangePreviewState,
} from "./use-exchange-preview";

export interface ExchangeSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly orgSlug: string;
  readonly organizationId: string;
  readonly order: OrderResponse;
  readonly allowedMethods: readonly PaymentMethod[];
  readonly methodLabels: Readonly<Record<string, string>>;
  readonly locale: DisplayLocale;
  readonly currency: CurrencyCode;
  readonly labels: ReturnLabels;
  readonly orderLabels: OrderLabels;
  readonly modifierGroups: readonly ModifierGroupResponse[];
  readonly unitLabels: Readonly<Record<string, string>>;
  readonly performersEnabled: boolean;
}

/** The body of the step the staff member is on. Each step reuses the return or the order screen's parts. */
function StepBody(props: {
  readonly sheet: ExchangeSheetProps;
  readonly form: ExchangeFormState;
  readonly actions: ExchangeFormActions;
  readonly exchange: ExchangeLabels;
  readonly previewState: ExchangePreviewState;
}): ReactElement {
  const { sheet, form, actions, exchange } = props;
  if (form.step === EXCHANGE_STEP.RETURN) {
    return (
      <ExchangeReturnStep
        organizationId={sheet.organizationId}
        order={sheet.order}
        labels={sheet.labels}
        orderLabels={sheet.orderLabels}
        actions={actions}
        returns={form.returns}
        needsNote={form.returns.reasonKey === "OTHER" && form.returns.note.trim() === ""}
      />
    );
  }
  if (form.step === EXCHANGE_STEP.NEW_LINES) {
    return (
      <ExchangeNewLinesStep
        organizationId={sheet.organizationId}
        order={sheet.order}
        labels={sheet.labels}
        orderLabels={sheet.orderLabels}
        actions={actions}
        lines={form.lines}
        discount={form.discount}
        orderNote={form.orderNote}
        currency={sheet.currency}
        locale={sheet.locale}
        modifierGroups={sheet.modifierGroups}
        unitLabels={sheet.unitLabels}
        performersEnabled={sheet.performersEnabled}
      />
    );
  }
  const methods = exchangeMethodsFor(sheet.allowedMethods);
  return (
    <ExchangePaymentStep
      exchange={exchange}
      returnLabels={sheet.labels}
      currency={sheet.currency}
      locale={sheet.locale}
      methods={methods}
      defaultMethod={methods[0] ?? SALES_EXCHANGE_PAYMENT_METHODS.CASH}
      methodLabels={sheet.methodLabels}
      previewState={props.previewState}
      payments={form.payments}
      actions={actions}
    />
  );
}

/** The step buttons, the blocker and the failure of the submit, and the PIN dialog of the submit. */
function ExchangeFooter(props: {
  readonly sheet: ExchangeSheetProps;
  readonly form: ExchangeFormState;
  readonly actions: ExchangeFormActions;
  readonly exchange: ExchangeLabels;
  readonly blocker: ExchangeBlocker | undefined;
  readonly submit: ExchangeSubmitState;
}): ReactElement {
  const { form, actions, exchange, submit } = props;
  const previous = stepBefore(form.step);
  const next = stepAfter(form.step);
  return (
    <div className="flex flex-col gap-3">
      {props.blocker === undefined || form.step !== EXCHANGE_STEP.PAYMENT ? null : (
        <p role="status" className="text-caption text-muted">
          {blockerMessageOf(props.blocker, exchange, props.sheet.labels)}
        </p>
      )}
      {submit.failure === undefined ? null : (
        <p role="alert" className="text-body text-danger">
          {submit.failure.message}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {previous === undefined ? null : (
          <Button variant="secondary" onClick={() => actions.goTo(previous)}>
            {exchange.back}
          </Button>
        )}
        {next === undefined ? (
          <Button
            disabled={props.blocker !== undefined || submit.isSubmitting}
            isLoading={submit.isSubmitting}
            onClick={() => void submit.submit()}
          >
            {exchange.submit}
          </Button>
        ) : (
          <Button
            disabled={stepBlockerOf(form.step, blockerInputOf(form, true)) !== undefined}
            onClick={() => actions.goTo(next)}
          >
            {exchange.next}
          </Button>
        )}
      </div>
      <LazyOrderApprovalDialog
        flow={submit.approvals.dialog}
        labels={props.sheet.orderLabels.approval}
      />
    </div>
  );
}

/** The steps of an exchange that is not saved yet: the step body, the blocker and the footer. */
function ExchangeWizard(props: {
  readonly sheet: ExchangeSheetProps;
  readonly form: ExchangeFormState;
  readonly actions: ExchangeFormActions;
  readonly exchange: ExchangeLabels;
  readonly previewState: ExchangePreviewState;
  readonly submit: ExchangeSubmitState;
}): ReactElement {
  const { sheet, form, actions, exchange, previewState, submit } = props;
  const blocker = exchangeBlockerOf(
    blockerInputOf(form, readyPreviewOf(previewState) !== undefined),
  );
  return (
    <div className="flex flex-col gap-4">
      <p className="text-caption text-muted">{stepTitleOf(form.step, exchange)}</p>
      <StepBody
        sheet={sheet}
        form={form}
        actions={actions}
        exchange={exchange}
        previewState={previewState}
      />
      <ExchangeFooter
        sheet={sheet}
        form={form}
        actions={actions}
        exchange={exchange}
        blocker={blocker}
        submit={submit}
      />
    </div>
  );
}

/** Exchange items: the goods that come back, the new goods, then the server's numbers and the payments. */
export function ExchangeSheet(props: ExchangeSheetProps): ReactElement {
  const { t } = useTranslator();
  const exchange = exchangeLabelsOf(t);
  const { form, actions } = useExchangeForm(props.order);
  const previewState = useExchangePreview({
    organizationId: props.organizationId,
    order: props.order,
    form,
    currency: props.currency,
  });
  const [created, setCreated] = useState<SalesExchangeResponse | undefined>(undefined);
  const submit = useExchangeSubmit({
    organizationId: props.organizationId,
    order: props.order,
    form,
    currency: props.currency,
    preview: readyPreviewOf(previewState),
    approvalLabels: props.orderLabels.approval,
    onCreated: setCreated,
  });
  if (!props.open) return <></>;
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        title={exchange.title}
        description={exchange.description}
        closeLabel={exchange.close}
      >
        {created === undefined ? (
          <ExchangeWizard
            sheet={props}
            form={form}
            actions={actions}
            exchange={exchange}
            previewState={previewState}
            submit={submit}
          />
        ) : (
          <ExchangeResult
            orgSlug={props.orgSlug}
            created={created}
            locale={props.locale}
            labels={exchange}
            onClose={() => props.onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

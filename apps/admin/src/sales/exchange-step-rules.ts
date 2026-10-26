import type { ExchangeLabels } from "./exchange-labels";
import {
  newLinesBlockerOf,
  returnBlockerOf,
  type ExchangeBlocker,
  type ExchangeBlockerInput,
} from "./exchange-model";
import { lineInputsOfDrafts } from "./order-lines";
import type { ReturnLabels } from "./return-labels";
import {
  EXCHANGE_STEP,
  invalidLineCountOf,
  type ExchangeFormState,
  type ExchangeStep,
} from "./use-exchange-sheet";

/** The rules of the sheet's steps: which step follows, what blocks it and what the blocker says. */
const STEP_ORDER: readonly ExchangeStep[] = [
  EXCHANGE_STEP.RETURN,
  EXCHANGE_STEP.NEW_LINES,
  EXCHANGE_STEP.PAYMENT,
];

/** The step after this one; undefined on the payment step, which ends in the submit. */
export function stepAfter(step: ExchangeStep): ExchangeStep | undefined {
  return STEP_ORDER[STEP_ORDER.indexOf(step) + 1];
}

/** The step before this one; undefined on the first step. */
export function stepBefore(step: ExchangeStep): ExchangeStep | undefined {
  const index = STEP_ORDER.indexOf(step);
  return index <= 0 ? undefined : STEP_ORDER[index - 1];
}

export function blockerInputOf(form: ExchangeFormState, hasPreview: boolean): ExchangeBlockerInput {
  return {
    returnDrafts: form.returns.drafts,
    reasonKey: form.returns.reasonKey,
    returnNote: form.returns.note,
    lineCount: lineInputsOfDrafts(form.lines).length,
    invalidLineCount: invalidLineCountOf(form.lines),
    payments: form.payments,
    hasPreview,
  };
}

/** Whether the staff member may go on from a step; the payment step is judged by the submit instead. */
export function stepBlockerOf(
  step: ExchangeStep,
  input: ExchangeBlockerInput,
): ExchangeBlocker | undefined {
  if (step === EXCHANGE_STEP.RETURN) return returnBlockerOf(input);
  if (step === EXCHANGE_STEP.NEW_LINES) return newLinesBlockerOf(input);
  return undefined;
}

/** The sentence the sheet shows for a blocker; each one names a field the staff member can fill. */
export function blockerMessageOf(
  blocker: ExchangeBlocker,
  exchange: ExchangeLabels,
  returns: ReturnLabels,
): string {
  const messages: Record<ExchangeBlocker, string> = {
    NO_RETURN_LINES: returns.sheet.noLines,
    REASON: returns.sheet.reason,
    NOTE: returns.sheet.noteRequired,
    NO_NEW_LINES: exchange.noNewLines,
    INVALID_NEW_LINES: exchange.invalidLines,
    PAYMENT_AMOUNT: exchange.amountRequired,
    PAYMENT_REFERENCE: exchange.referenceRequired,
    NO_PREVIEW: exchange.previewNeeded,
  };
  return messages[blocker];
}

export function stepTitleOf(step: ExchangeStep, exchange: ExchangeLabels): string {
  if (step === EXCHANGE_STEP.RETURN) return exchange.stepReturn;
  if (step === EXCHANGE_STEP.NEW_LINES) return exchange.stepNewLines;
  return exchange.stepPayment;
}

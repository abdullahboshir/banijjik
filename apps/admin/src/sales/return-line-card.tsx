"use client";

import type { ReturnDisposition } from "@banijjik/contracts/sales";
import { RETURN_DISPOSITION } from "@banijjik/contracts/sales";
import { Button, FormField, Select } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { ReturnLabels } from "./return-labels";
import type { ReturnLineDraft } from "./return-model";
import { isLineReturnable, type ReturnFormActions } from "./use-return-sheet";

const DISPOSITIONS = Object.values(RETURN_DISPOSITION);

function StepperButton(props: {
  readonly label: string;
  readonly disabled: boolean;
  readonly onPress: () => void;
  readonly glyph: string;
}): ReactElement {
  return (
    <Button
      variant="secondary"
      className="min-h-11 min-w-11"
      aria-label={props.label}
      disabled={props.disabled}
      onClick={props.onPress}
    >
      {props.glyph}
    </Button>
  );
}

interface LineProps {
  readonly draft: ReturnLineDraft;
  readonly labels: ReturnLabels;
  readonly actions: ReturnFormActions;
}

/** The stepper of one line: the count moves by one and stops at what is left on the line. */
function QuantityStepper(props: LineProps & { readonly returnable: boolean }): ReactElement {
  const { draft, labels, actions, returnable } = props;
  return (
    <>
      <StepperButton
        label={labels.sheet.decrease}
        glyph="−"
        disabled={!returnable || draft.quantity === 0}
        onPress={() => actions.setQuantity(draft.orderLineId, draft.quantity - 1)}
      />
      <span className="min-w-8 text-center font-money text-body" aria-live="polite">
        {draft.quantity}
      </span>
      <StepperButton
        label={labels.sheet.increase}
        glyph="+"
        disabled={!returnable || draft.quantity >= draft.remainingQuantity}
        onPress={() => actions.setQuantity(draft.orderLineId, draft.quantity + 1)}
      />
    </>
  );
}

export function ReturnLineCard(props: LineProps): ReactElement {
  const { draft, labels, actions } = props;
  const returnable = isLineReturnable(draft);
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-body font-medium text-primary">{draft.nameSnapshot}</span>
        <dl className="flex gap-3 text-caption text-muted">
          <div>
            <dt className="inline">{labels.sheet.sold} </dt>
            <dd className="inline font-money">{draft.soldQuantity}</dd>
          </div>
          <div>
            <dt className="inline">{labels.sheet.left} </dt>
            <dd className="inline font-money">{draft.remainingQuantity}</dd>
          </div>
        </dl>
      </div>
      {returnable ? null : <p className="text-caption text-muted">{labels.sheet.fullyReturned}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper draft={draft} labels={labels} actions={actions} returnable={returnable} />
        <FormField
          label={labels.sheet.disposition}
          htmlFor={`return-disposition-${draft.orderLineId}`}
        >
          <Select
            id={`return-disposition-${draft.orderLineId}`}
            value={draft.disposition}
            disabled={!returnable}
            onChange={(event) =>
              actions.setDisposition(draft.orderLineId, event.target.value as ReturnDisposition)
            }
          >
            {DISPOSITIONS.map((disposition) => (
              <option key={disposition} value={disposition}>
                {labels.dispositions[disposition]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
    </li>
  );
}

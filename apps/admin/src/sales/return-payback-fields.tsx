"use client";

import type { PaymentMethod } from "@banijjik/contracts/payment";
import type { SalesReturnReverseReason } from "@banijjik/contracts/sales";
import { Checkbox, FormField, Select, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { ReturnLabels } from "./return-labels";
import { needsRefundReference } from "./return-model";

export interface ReverseFormState {
  readonly reasonKey: SalesReturnReverseReason | undefined;
  readonly note: string;
  readonly payback: boolean;
  readonly paybackMethod: PaymentMethod | null;
  readonly paybackReference: string;
}

export function PaybackFields(props: {
  readonly form: ReverseFormState;
  readonly setForm: (update: Partial<ReverseFormState>) => void;
  readonly methods: readonly PaymentMethod[];
  readonly methodLabels: Readonly<Record<string, string>>;
  readonly labels: ReturnLabels;
}): ReactElement {
  const { form, setForm, labels } = props;
  return (
    <>
      <Checkbox
        label={labels.reverse.payback}
        checked={form.payback}
        onChange={(event) => setForm({ payback: event.target.checked })}
      />
      <p className="text-caption text-muted">{labels.reverse.paybackHint}</p>
      {form.payback ? (
        <>
          <FormField label={labels.reverse.paybackMethod} htmlFor="reverse-payback-method" required>
            <Select
              id="reverse-payback-method"
              value={form.paybackMethod ?? ""}
              onChange={(event) =>
                setForm({
                  paybackMethod:
                    event.target.value === "" ? null : (event.target.value as PaymentMethod),
                })
              }
            >
              <option value="">{labels.reverse.paybackMethod}</option>
              {props.methods.map((method) => (
                <option key={method} value={method}>
                  {props.methodLabels[method] ?? method}
                </option>
              ))}
            </Select>
          </FormField>
          {needsRefundReference(form.paybackMethod) ? (
            <FormField
              label={labels.reverse.paybackReference}
              htmlFor="reverse-payback-reference"
              required
            >
              <TextInput
                id="reverse-payback-reference"
                value={form.paybackReference}
                onChange={(event) => setForm({ paybackReference: event.target.value })}
              />
            </FormField>
          ) : null}
        </>
      ) : null}
    </>
  );
}

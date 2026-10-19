"use client";

import type { TaxClassResponse } from "@banijjik/contracts/pricing";
import { Button, FormField, TextInput } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useState, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { useRecordAction, type RecordAction } from "../catalog/use-record-action";
import { archiveTaxClass, createTaxClass } from "./pricing-api";
import type { TaxClassLabels } from "./pricing-labels";

export interface TaxClassesManagerProps {
  organizationId: string;
  taxClasses: TaxClassResponse[];
  labels: TaxClassLabels;
  canUpdate: boolean;
}

/** Percent text (e.g. "7.5") to basis points; at most two fraction digits. */
export function ratePercentToBasisPoints(text: string): number | undefined {
  const trimmed = text.trim();
  if (!/^\d{1,3}(?:\.\d{1,2})?$/u.test(trimmed)) return undefined;
  const [wholePart, fractionPart = ""] = trimmed.split(".");
  const whole = Number(wholePart);
  const fraction = Number((fractionPart + "00").slice(0, 2));
  const basisPoints = whole * 100 + fraction;
  if (!Number.isSafeInteger(basisPoints) || basisPoints > 100_000) return undefined;
  return basisPoints;
}

function rateTextOf(rateBasisPoints: number): string {
  const whole = Math.floor(rateBasisPoints / 100);
  const fraction = rateBasisPoints % 100;
  if (fraction === 0) return String(whole);
  return `${whole}.${String(fraction).padStart(2, "0").replace(/0$/u, "")}`;
}

function Failure(props: { action: RecordAction; labels: TaxClassLabels }): ReactElement | null {
  const { t } = useTranslator();
  const { failure } = props.action;
  if (!failure) return null;
  if (failure.isConflict) {
    return (
      <div role="alert" className="flex flex-col gap-2 text-small text-danger">
        <p>{props.labels["taxClasses.conflict"]}</p>
        <Button variant="secondary" onClick={props.action.reload}>
          {props.labels["taxClasses.reload"]}
        </Button>
      </div>
    );
  }
  return (
    <p role="alert" className="text-small text-danger">
      {t(knownMessageKeyOrInternal(failure.messageKey ?? "errors.internal"))}
    </p>
  );
}

function AddTaxClassFields(props: {
  labels: TaxClassLabels;
  taxClassKey: string;
  name: string;
  rate: string;
  onTaxClassKey: (value: string) => void;
  onName: (value: string) => void;
  onRate: (value: string) => void;
}): ReactElement {
  return (
    <>
      <FormField
        label={props.labels["taxClasses.key"]}
        htmlFor="new-tax-class-key"
        hint={props.labels["taxClasses.keyHint"]}
      >
        <TextInput
          id="new-tax-class-key"
          value={props.taxClassKey}
          onChange={(event) => props.onTaxClassKey(event.target.value)}
        />
      </FormField>
      <FormField label={props.labels["taxClasses.name"]} htmlFor="new-tax-class-name">
        <TextInput
          id="new-tax-class-name"
          value={props.name}
          onChange={(event) => props.onName(event.target.value)}
        />
      </FormField>
      <FormField
        label={props.labels["taxClasses.rate"]}
        htmlFor="new-tax-class-rate"
        hint={props.labels["taxClasses.rateHint"]}
      >
        <TextInput
          id="new-tax-class-rate"
          inputMode="decimal"
          value={props.rate}
          onChange={(event) => props.onRate(event.target.value)}
        />
      </FormField>
    </>
  );
}

function AddTaxClass(props: {
  organizationId: string;
  labels: TaxClassLabels;
  action: RecordAction;
}): ReactElement {
  const { labels, organizationId, action } = props;
  const [taxClassKey, setTaxClassKey] = useState("");
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  async function save(): Promise<void> {
    const rateBasisPoints = ratePercentToBasisPoints(rate);
    if (taxClassKey.trim() === "" || name.trim() === "" || rateBasisPoints === undefined) return;
    const done = await action.run(() =>
      createTaxClass(organizationId, {
        taxClassKey: taxClassKey.trim(),
        name: name.trim(),
        rateBasisPoints,
      }),
    );
    if (done) {
      setTaxClassKey("");
      setName("");
      setRate("");
    }
  }
  return (
    <div className="flex flex-col gap-3 rounded-md border border-default p-3">
      <AddTaxClassFields
        labels={labels}
        taxClassKey={taxClassKey}
        name={name}
        rate={rate}
        onTaxClassKey={setTaxClassKey}
        onName={setName}
        onRate={setRate}
      />
      <Button onClick={() => void save()}>{labels["taxClasses.save"]}</Button>
    </div>
  );
}

/** Tax classes of the business: list, add and archive (card 3.4). */
export function TaxClassesManager(props: TaxClassesManagerProps): ReactElement {
  const { labels, taxClasses, organizationId, canUpdate } = props;
  const action = useRecordAction();
  return (
    <div className="flex flex-col gap-4">
      {canUpdate ? (
        <AddTaxClass organizationId={organizationId} labels={labels} action={action} />
      ) : null}
      <Failure action={action} labels={labels} />
      {taxClasses.length === 0 ? (
        <p className="text-body text-secondary">{labels["taxClasses.empty"]}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {taxClasses.map((row) => (
            <li
              key={row.taxClassId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-default p-3"
            >
              <span className="flex min-w-0 flex-col">
                <span className="break-words text-body font-semibold text-primary">{row.name}</span>
                <span className="text-small text-secondary">
                  {row.taxClassKey} · {rateTextOf(row.rateBasisPoints)}%
                </span>
              </span>
              {canUpdate ? (
                <Button
                  variant="secondary"
                  onClick={() =>
                    void action.run(() =>
                      archiveTaxClass(organizationId, row.taxClassId, row.version),
                    )
                  }
                >
                  {labels["taxClasses.archive"]}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

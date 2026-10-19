"use client";

import { isUnitKey, UNIT_KEY, type UnitKey } from "@banijjik/contracts/catalog";
import type { TaxClassResponse } from "@banijjik/contracts/pricing";
import { PageSection } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fillLabel } from "./catalog-labels";
import { ChoiceField, TextField, ToggleField, type SectionProps } from "./editor-fields";
import type { OfferingFormState } from "./offering-form";
import { canSellLoose, looseCountingUnit } from "./quantity-rule";

export interface PriceProps extends SectionProps {
  unitNames: Readonly<Record<UnitKey, string>>;
  currencySymbol: string;
  taxClasses: readonly TaxClassResponse[];
}

type FormRow = OfferingFormState["rows"][number];

function LooseRule(props: PriceProps): ReactElement | null {
  const { form, labels, update, errors, isReadOnly, unitNames } = props;
  if (!canSellLoose(form.unitKey)) return null;
  const unit = unitNames[looseCountingUnit(form.unitKey)];
  return (
    <div className="flex flex-col gap-3">
      <ToggleField
        label={labels["loose.toggle"]}
        checked={form.isLoose}
        disabled={isReadOnly}
        onChange={(isLoose) => update({ isLoose })}
      />
      {form.isLoose ? (
        <>
          <p className="text-small text-secondary">
            {fillLabel(labels["loose.example"], { unit })}
          </p>
          <TextField
            id="loose-min"
            label={fillLabel(labels["loose.min"], { unit })}
            value={form.looseMin}
            inputMode="numeric"
            error={errors["quantityRule"]}
            disabled={isReadOnly}
            onChange={(looseMin) => update({ looseMin })}
          />
          <TextField
            id="loose-step"
            label={fillLabel(labels["loose.step"], { unit })}
            value={form.looseStep}
            inputMode="numeric"
            disabled={isReadOnly}
            onChange={(looseStep) => update({ looseStep })}
          />
        </>
      ) : null}
    </div>
  );
}

function DefaultVariantFields(props: {
  row: FormRow;
  labels: PriceProps["labels"];
  errors: PriceProps["errors"];
  isReadOnly: boolean;
  currencySymbol: string;
  updateRow: (patch: Partial<FormRow>) => void;
}): ReactElement {
  const { row, labels, errors, isReadOnly, currencySymbol, updateRow } = props;
  return (
    <>
      <TextField
        id="offering-price"
        label={labels["field.price"]}
        value={row.price}
        inputMode="decimal"
        hint={fillLabel(labels["field.priceHint"], { currency: currencySymbol })}
        error={errors["price"]}
        disabled={isReadOnly}
        onChange={(price) => updateRow({ price })}
      />
      <TextField
        id="offering-compare-at"
        label={labels["field.compareAt"]}
        value={row.compareAtPrice}
        inputMode="decimal"
        hint={labels["field.compareAtHint"]}
        error={errors["compareAtPrice"]}
        disabled={isReadOnly}
        onChange={(compareAtPrice) => updateRow({ compareAtPrice })}
      />
      <TextField
        id="offering-sku"
        label={labels["field.sku"]}
        value={row.sku}
        error={errors["sku"]}
        disabled={isReadOnly}
        onChange={(sku) => updateRow({ sku })}
      />
    </>
  );
}

/** The price of the one Default variant, and how the offering is counted. With options each row has its own price. */
export function EditorPrice(props: PriceProps): ReactElement {
  const { form, labels, update, errors, isReadOnly, unitNames, currencySymbol, taxClasses } = props;
  const row = form.rows[0];
  function updateRow(patch: Partial<NonNullable<typeof row>>): void {
    if (row) update({ rows: [{ ...row, ...patch }, ...form.rows.slice(1)] });
  }
  return (
    <PageSection title={labels["section.price.title"]} help={labels["section.price.help"]}>
      <ChoiceField
        id="offering-unit"
        label={labels["field.unit"]}
        value={form.unitKey}
        disabled={isReadOnly}
        options={Object.values(UNIT_KEY).map((unitKey) => ({
          value: unitKey,
          label: unitNames[unitKey],
        }))}
        onChange={(value) => isUnitKey(value) && update({ unitKey: value })}
      />
      <ChoiceField
        id="offering-tax-class"
        label={labels["field.taxClass"]}
        value={form.taxClassKey}
        disabled={isReadOnly}
        options={[
          { value: "", label: labels["field.taxClassNone"] },
          ...taxClasses.map((taxClass) => ({
            value: taxClass.taxClassKey,
            label: taxClass.name,
          })),
        ]}
        onChange={(taxClassKey) => update({ taxClassKey })}
      />
      {form.hasOptions || !row ? null : (
        <DefaultVariantFields
          row={row}
          labels={labels}
          errors={errors}
          isReadOnly={isReadOnly}
          currencySymbol={currencySymbol}
          updateRow={updateRow}
        />
      )}
      <LooseRule {...props} />
    </PageSection>
  );
}

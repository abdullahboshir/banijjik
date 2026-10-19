"use client";

import { OFFERING_KIND } from "@banijjik/contracts";
import type { UnitKey } from "@banijjik/contracts/catalog";
import type { ReactElement } from "react";
import { fillLabel } from "./catalog-labels";
import { TextField } from "./editor-fields";
import type { PriceProps } from "./editor-price";
import type { VariantRow } from "./offering-form";
import { StockFromSection } from "./stock-from-section";

export function EditorPriceDefaultRow(props: {
  priceProps: PriceProps;
  row: VariantRow;
  updateRow: (patch: Partial<VariantRow>) => void;
}): ReactElement {
  const { priceProps, row, updateRow } = props;
  const { form, labels, errors, isReadOnly, unitNames, currencySymbol } = priceProps;
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
      {form.kind === OFFERING_KIND.PRODUCT ? (
        <StockFromSection
          organizationId={priceProps.organizationId}
          rowIndex={0}
          stockComponents={row.stockComponents}
          labels={labels}
          pickerLabels={priceProps.stockPickerLabels}
          unitLabel={(unitKey: UnitKey) => unitNames[unitKey]}
          isReadOnly={isReadOnly}
          onChange={(stockComponents) => updateRow({ stockComponents })}
        />
      ) : null}
    </>
  );
}

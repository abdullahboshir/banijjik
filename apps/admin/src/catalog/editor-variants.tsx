"use client";

import { MAX_OPTION_NAMES_PER_VARIANT, type UnitKey } from "@banijjik/contracts/catalog";
import { Button, PageSection } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import type { ItemPickerLabels } from "../stock/stock-labels";
import { fillLabel, type EditorLabels } from "./catalog-labels";
import { TextField, ToggleField, type SectionProps } from "./editor-fields";
import { EditorVariantRow } from "./editor-variant-row";
import { emptyRow, type VariantRow } from "./offering-form";
import {
  generateRows,
  variantNameOf,
  type OptionDraft,
  type OptionValues,
} from "./variant-generator";

export interface VariantsProps extends SectionProps {
  currencySymbol: string;
  organizationId: string;
  unitNames: Readonly<Record<UnitKey, string>>;
  stockPickerLabels: ItemPickerLabels;
  /** The rows as loaded: a combination that comes back while typing gets its old id back (ADR-098). */
  originalRows: readonly VariantRow[];
}

function ValueAdder(props: {
  index: number;
  labels: EditorLabels;
  isReadOnly: boolean;
  onAdd: (value: string) => void;
}): ReactElement {
  const [text, setText] = useState("");
  function add(): void {
    if (text.trim() === "") return;
    props.onAdd(text);
    setText("");
  }
  return (
    <div className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <TextField
          id={`option-${props.index}-value`}
          label={props.labels["options.values"]}
          value={text}
          disabled={props.isReadOnly}
          hint={props.labels["options.valuePlaceholder"]}
          onChange={setText}
        />
      </div>
      <Button variant="secondary" disabled={props.isReadOnly} onClick={add}>
        {props.labels["options.addValue"]}
      </Button>
    </div>
  );
}

function OptionEditor(props: {
  option: OptionDraft;
  index: number;
  labels: EditorLabels;
  isReadOnly: boolean;
  onChange: (option: OptionDraft) => void;
  onRemove: () => void;
}): ReactElement {
  const { option, index, labels, isReadOnly } = props;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-default p-3">
      <TextField
        id={`option-${index}-name`}
        label={labels["options.name"]}
        value={option.name}
        hint={labels["options.namePlaceholder"]}
        disabled={isReadOnly}
        onChange={(name) => props.onChange({ ...option, name })}
      />
      <ul className="flex flex-wrap gap-2">
        {option.values.map((value) => (
          <li key={value}>
            <Button
              variant="secondary"
              disabled={isReadOnly}
              aria-label={fillLabel(labels["options.removeValue"], { value })}
              onClick={() =>
                props.onChange({ ...option, values: option.values.filter((v) => v !== value) })
              }
            >
              {value} ×
            </Button>
          </li>
        ))}
      </ul>
      <ValueAdder
        index={index}
        labels={labels}
        isReadOnly={isReadOnly}
        onAdd={(value) => props.onChange({ ...option, values: [...option.values, value.trim()] })}
      />
      <Button variant="secondary" disabled={isReadOnly} onClick={props.onRemove}>
        {labels["options.remove"]}
      </Button>
    </div>
  );
}

function VariantRows(props: VariantsProps & { isCapped: boolean }): ReactElement {
  const { form, labels, update } = props;
  if (form.rows.length === 0 || form.options.length === 0) {
    return <p className="text-small text-secondary">{labels["options.none"]}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-body font-semibold text-primary">{labels["options.rows"]}</h3>
      <p className="text-small text-secondary">{labels["options.rowsHelp"]}</p>
      {props.isCapped ? (
        <p role="alert" className="text-small text-danger">
          {labels["options.limit"]}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {form.rows.map((row, index) => (
          <EditorVariantRow
            key={row.variantId ?? variantNameOf(row.optionValues)}
            row={row}
            index={index}
            variantsProps={props}
            onChange={(changed) =>
              update({ rows: form.rows.map((item, at) => (at === index ? changed : item)) })
            }
          />
        ))}
      </ul>
    </div>
  );
}

/** Options (size, length, term) expand into one priced row per combination, up to 100 (13-UX 4.1a). */
export function EditorVariants(props: VariantsProps): ReactElement {
  const { form, labels, update, isReadOnly } = props;
  const [isCapped, setIsCapped] = useState(false);

  function changeOptions(options: OptionDraft[]): void {
    const generated = generateRows<VariantRow>(
      options,
      [...form.rows, ...props.originalRows],
      (values: OptionValues) => emptyRow(values),
    );
    setIsCapped(generated.isCapped);
    update({ options, rows: generated.rows });
  }

  function toggleOptions(hasOptions: boolean): void {
    if (hasOptions) {
      update({ hasOptions, options: [{ name: "", values: [] }], rows: [] });
      return;
    }
    update({ hasOptions, options: [], rows: [emptyRow()] });
  }

  return (
    <PageSection title={labels["section.options.title"]} help={labels["section.options.help"]}>
      <ToggleField
        label={labels["options.toggle"]}
        checked={form.hasOptions}
        disabled={isReadOnly}
        onChange={toggleOptions}
      />
      {form.hasOptions ? (
        <>
          {form.options.map((option, index) => (
            <OptionEditor
              key={index}
              option={option}
              index={index}
              labels={labels}
              isReadOnly={isReadOnly}
              onChange={(changed) =>
                changeOptions(form.options.map((item, at) => (at === index ? changed : item)))
              }
              onRemove={() => changeOptions(form.options.filter((_item, at) => at !== index))}
            />
          ))}
          {form.options.length < MAX_OPTION_NAMES_PER_VARIANT ? (
            <Button
              variant="secondary"
              disabled={isReadOnly}
              onClick={() => update({ options: [...form.options, { name: "", values: [] }] })}
            >
              {labels["options.add"]}
            </Button>
          ) : null}
          <VariantRows {...props} isCapped={isCapped} />
        </>
      ) : null}
    </PageSection>
  );
}

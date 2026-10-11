"use client";

import { Button, FormField, Select } from "@banijjik/ui";
import type { ReactElement } from "react";
import { useTranslator } from "../lib/i18n/i18n-provider";
import type { AssignmentLabels } from "./assignment-labels";
import { withNumber } from "./assignment-labels";
import type { AssignmentOptions } from "./assignment-options";
import { DUPLICATE_ROW_KEY, emptyRow, type AssignmentRow, type RowErrors } from "./assignment-rows";

export interface AssignmentRowsEditorProps {
  idPrefix: string;
  rows: AssignmentRow[];
  options: AssignmentOptions;
  errors: Record<number, RowErrors>;
  labels: AssignmentLabels;
  onChange: (rows: AssignmentRow[]) => void;
}

interface RowFieldsProps extends Omit<AssignmentRowsEditorProps, "rows" | "onChange"> {
  row: AssignmentRow;
  index: number;
  canRemove: boolean;
  onRowChange: (row: AssignmentRow) => void;
  onRemove: () => void;
}

function useErrorText(labels: AssignmentLabels): (key: string | undefined) => string | undefined {
  const { t } = useTranslator();
  return (key) => {
    if (key === undefined) return undefined;
    return key === DUPLICATE_ROW_KEY ? labels.duplicate : t(key);
  };
}

function RowFields(props: RowFieldsProps): ReactElement {
  const { row, index, options, labels, errors, idPrefix } = props;
  const errorText = useErrorText(labels);
  const number = index + 1;
  const roleId = `${idPrefix}-role-${index}`;
  const locationId = `${idPrefix}-location-${index}`;
  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-default p-3">
      <legend className="px-1 text-small font-semibold text-secondary">
        {withNumber(labels.row, number)}
      </legend>
      <FormField label={labels.role} htmlFor={roleId} error={errorText(errors[index]?.roleId)}>
        <Select
          id={roleId}
          value={row.roleId}
          aria-invalid={errors[index]?.roleId ? true : undefined}
          onChange={(event) => props.onRowChange({ ...row, roleId: event.target.value })}
        >
          <option value="">{labels.chooseRole}</option>
          {options.roles.map((role) => (
            <option key={role.roleId} value={role.roleId}>
              {role.label}
            </option>
          ))}
        </Select>
      </FormField>
      {options.isSingleLocation ? null : (
        <FormField
          label={labels.location}
          htmlFor={locationId}
          error={errorText(errors[index]?.locationId)}
        >
          <Select
            id={locationId}
            value={row.locationId}
            aria-invalid={errors[index]?.locationId ? true : undefined}
            onChange={(event) => props.onRowChange({ ...row, locationId: event.target.value })}
          >
            <option value="">{labels.chooseLocation}</option>
            {options.locations.map((location) => (
              <option key={location.locationId} value={location.locationId}>
                {location.label}
              </option>
            ))}
          </Select>
        </FormField>
      )}
      {props.canRemove ? (
        <Button variant="ghost" onClick={props.onRemove}>
          {withNumber(labels.remove, number)}
        </Button>
      ) : null}
    </fieldset>
  );
}

/** Rows of role plus location (13-UX section 4.3). With one location the location select is not shown. */
export function AssignmentRowsEditor(props: AssignmentRowsEditorProps): ReactElement {
  const { rows, onChange, options } = props;
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <RowFields
          // Rows have no identity of their own; the position is the only key there is.
          key={index}
          {...props}
          row={row}
          index={index}
          canRemove={rows.length > 1}
          onRowChange={(changed) => onChange(rows.map((r, i) => (i === index ? changed : r)))}
          onRemove={() => onChange(rows.filter((_, i) => i !== index))}
        />
      ))}
      <Button
        variant="secondary"
        onClick={() => onChange([...rows, emptyRow(options.isSingleLocation)])}
      >
        {props.labels.add}
      </Button>
    </div>
  );
}

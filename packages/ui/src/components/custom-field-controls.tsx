import { useState, type ReactElement } from "react";
import { parseMoneyInput } from "../format/parse-money-input.js";
import { Checkbox, Select, Textarea, TextInput, formFieldMessageId } from "./form.js";
import type {
  CustomFieldFileSupport,
  CustomFieldInputKind,
  CustomFieldOption,
} from "./custom-field-types.js";
import {
  parseIntegerInput,
  textOrNull,
  toDateTimeLocalValue,
  toIsoWithBrowserOffset,
} from "./custom-field-value.js";

const DEFAULT_MONEY_FRACTION_DIGITS = 2;

export interface CustomFieldControlProps {
  readonly fieldKey: string;
  readonly inputKind: CustomFieldInputKind;
  readonly label: string;
  readonly hint?: string | undefined;
  readonly options?: readonly CustomFieldOption[] | undefined;
  readonly maxLength?: number | undefined;
  readonly isRequired: boolean;
  readonly value: unknown;
  readonly error: string | undefined;
  readonly onValueChange: (value: unknown) => void;
  readonly inputId: string;
  readonly disabled: boolean;
  readonly currencySymbol: string;
  readonly moneyFractionDigits: number;
  readonly chooseLabel: string;
  readonly files?: CustomFieldFileSupport | undefined;
}

function describedBy(props: CustomFieldControlProps): string | undefined {
  const ids: string[] = [];
  if (props.hint) ids.push(formFieldMessageId(props.inputId, "hint"));
  if (props.error) ids.push(formFieldMessageId(props.inputId, "error"));
  if (ids.length === 0) return undefined;
  return ids.join(" ");
}

function ariaProps(props: CustomFieldControlProps): {
  readonly "aria-invalid"?: true;
  readonly "aria-describedby"?: string;
} {
  const described = describedBy(props);
  return {
    ...(props.error ? { "aria-invalid": true as const } : {}),
    ...(described ? { "aria-describedby": described } : {}),
  };
}

const TEXT_MODES = {
  TEXT: { type: "text", inputMode: "text" },
  PHONE: { type: "tel", inputMode: "tel" },
  EMAIL: { type: "email", inputMode: "email" },
  URL: { type: "url", inputMode: "url" },
} as const;

type TextKind = keyof typeof TEXT_MODES;

function isTextKind(kind: CustomFieldInputKind): kind is TextKind {
  return Object.hasOwn(TEXT_MODES, kind);
}

export function TextLikeControl(props: CustomFieldControlProps): ReactElement {
  const mode = isTextKind(props.inputKind) ? TEXT_MODES[props.inputKind] : TEXT_MODES.TEXT;
  const text = typeof props.value === "string" ? props.value : "";
  return (
    <TextInput
      id={props.inputId}
      type={mode.type}
      inputMode={mode.inputMode}
      autoComplete="off"
      maxLength={props.maxLength}
      disabled={props.disabled}
      value={text}
      onChange={(event) => props.onValueChange(textOrNull(event.target.value))}
      {...ariaProps(props)}
    />
  );
}

export function LongTextControl(props: CustomFieldControlProps): ReactElement {
  const text = typeof props.value === "string" ? props.value : "";
  return (
    <Textarea
      id={props.inputId}
      autoComplete="off"
      maxLength={props.maxLength}
      disabled={props.disabled}
      value={text}
      onChange={(event) => props.onValueChange(textOrNull(event.target.value))}
      {...ariaProps(props)}
    />
  );
}

export function IntegerControl(props: CustomFieldControlProps): ReactElement {
  const text = typeof props.value === "number" ? String(props.value) : "";
  const shown = typeof props.value === "string" ? props.value : text;
  return (
    <TextInput
      id={props.inputId}
      inputMode="numeric"
      autoComplete="off"
      disabled={props.disabled}
      value={shown}
      onChange={(event) => props.onValueChange(parseIntegerInput(event.target.value))}
      {...ariaProps(props)}
    />
  );
}

export function DecimalControl(props: CustomFieldControlProps): ReactElement {
  const text = typeof props.value === "string" ? props.value : "";
  return (
    <TextInput
      id={props.inputId}
      inputMode="decimal"
      autoComplete="off"
      disabled={props.disabled}
      value={text}
      onChange={(event) => props.onValueChange(textOrNull(event.target.value))}
      {...ariaProps(props)}
    />
  );
}

function moneyText(value: unknown, fractionDigits: number): string {
  if (typeof value === "string") return value;
  if (typeof value !== "number" || !Number.isSafeInteger(value)) return "";
  const negative = value < 0;
  const digits = String(Math.abs(value)).padStart(fractionDigits + 1, "0");
  const splitAt = digits.length - fractionDigits;
  const body =
    fractionDigits === 0 ? digits : `${digits.slice(0, splitAt)}.${digits.slice(splitAt)}`;
  if (!negative) return body;
  return `-${body}`;
}

function sameMoney(text: string, value: unknown, fractionDigits: number): boolean {
  if (typeof value === "string") return text === value;
  if (typeof value !== "number") return text === "";
  return parseMoneyInput(text, fractionDigits)?.minorUnits === value;
}

function moneyCommit(text: string, fractionDigits: number): number | string | null {
  if (text.trim() === "") return null;
  const parsed = parseMoneyInput(text, fractionDigits);
  if (!parsed) return text;
  return parsed.minorUnits;
}

export function MoneyControl(props: CustomFieldControlProps): ReactElement {
  const fractionDigits = props.moneyFractionDigits ?? DEFAULT_MONEY_FRACTION_DIGITS;
  const [text, setText] = useState(() => moneyText(props.value, fractionDigits));
  const [seenValue, setSeenValue] = useState(props.value);
  if (props.value !== seenValue) {
    setSeenValue(props.value);
    if (!sameMoney(text, props.value, fractionDigits))
      setText(moneyText(props.value, fractionDigits));
  }
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span aria-hidden="true" className="text-body text-secondary">
        {props.currencySymbol}
      </span>
      <TextInput
        id={props.inputId}
        inputMode="decimal"
        autoComplete="off"
        disabled={props.disabled}
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          props.onValueChange(moneyCommit(next, fractionDigits));
        }}
        {...ariaProps(props)}
      />
    </div>
  );
}

export function BooleanControl(props: CustomFieldControlProps): ReactElement {
  // Checkbox always paints its own label. Leaving it empty keeps the field label above the box
  // as the single accessible name (a second copy would be read twice).
  return (
    <Checkbox
      id={props.inputId}
      label=""
      disabled={props.disabled}
      checked={props.value === true}
      onChange={(event) => props.onValueChange(event.target.checked)}
      {...ariaProps(props)}
    />
  );
}

export function DateControl(props: CustomFieldControlProps): ReactElement {
  const text = typeof props.value === "string" ? props.value : "";
  return (
    <TextInput
      id={props.inputId}
      type="date"
      autoComplete="off"
      disabled={props.disabled}
      value={text}
      onChange={(event) => props.onValueChange(textOrNull(event.target.value))}
      {...ariaProps(props)}
    />
  );
}

export function DateTimeControl(props: CustomFieldControlProps): ReactElement {
  return (
    <TextInput
      id={props.inputId}
      type="datetime-local"
      autoComplete="off"
      disabled={props.disabled}
      value={toDateTimeLocalValue(props.value)}
      onChange={(event) => {
        const next = event.target.value;
        props.onValueChange(next === "" ? null : toIsoWithBrowserOffset(next));
      }}
      {...ariaProps(props)}
    />
  );
}

export function SelectControl(props: CustomFieldControlProps): ReactElement {
  const text = typeof props.value === "string" ? props.value : "";
  return (
    <Select
      id={props.inputId}
      disabled={props.disabled}
      value={text}
      onChange={(event) => props.onValueChange(textOrNull(event.target.value))}
      {...ariaProps(props)}
    >
      {props.isRequired ? null : <option value="">{props.chooseLabel}</option>}
      {(props.options ?? []).map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

function selectedValues(value: unknown): ReadonlySet<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.filter((item): item is string => typeof item === "string"));
}

function toggleOption(
  optionValue: string,
  selected: ReadonlySet<string>,
  options: readonly CustomFieldOption[],
): string[] {
  const next = new Set(selected);
  if (next.has(optionValue)) next.delete(optionValue);
  else next.add(optionValue);
  return options.map((option) => option.value).filter((value) => next.has(value));
}

export function MultiSelectControl(props: CustomFieldControlProps): ReactElement {
  const options = props.options ?? [];
  const selected = selectedValues(props.value);
  return (
    <div
      role="group"
      aria-label={props.label}
      className="flex min-w-0 flex-col"
      {...ariaProps(props)}
    >
      {options.map((option) => (
        <Checkbox
          key={option.value}
          label={option.label}
          disabled={props.disabled}
          checked={selected.has(option.value)}
          onChange={() => props.onValueChange(toggleOption(option.value, selected, options))}
        />
      ))}
    </div>
  );
}

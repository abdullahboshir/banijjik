"use client";

import { BRAND_COLOR_PRESETS } from "@banijjik/contracts";
import { Button, FormField, TextInput, cn, formFieldMessageId } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import type { FieldErrors } from "../auth/field-errors";
import { fillTemplate, type BrandingLabels, type ColourLabels } from "./branding-labels";
import {
  checkColour,
  matchingPresetKey,
  type BrandingFormState,
  type ColourCheck,
  type ColourKind,
} from "./branding-state";

const FALLBACK_PICKER_COLOUR = "#000000";

export interface ColourFieldsProps {
  state: BrandingFormState;
  errors: FieldErrors;
  disabled: boolean;
  labels: BrandingLabels;
  /** Turns the message key of a refused colour into text. */
  errorText: (messageKey: string) => string;
  onChange: (changes: Partial<BrandingFormState>) => void;
}

function PresetSwatches(props: ColourFieldsProps): ReactElement {
  const { state, disabled, labels, onChange } = props;
  const chosenKey = matchingPresetKey(state);
  return (
    <div role="group" aria-label={labels.presetsGroup} className="flex flex-wrap gap-2">
      {BRAND_COLOR_PRESETS.map((preset) => {
        const isChosen = preset.presetKey === chosenKey;
        const name = labels.presetNames[preset.presetKey] ?? preset.presetKey;
        return (
          <button
            key={preset.presetKey}
            type="button"
            disabled={disabled}
            aria-pressed={isChosen}
            aria-label={name}
            title={name}
            onClick={() =>
              onChange({ primaryColor: preset.primaryColor, accentColor: preset.accentColor })
            }
            className={cn(
              "flex size-11 items-center justify-center rounded-full border-2 disabled:opacity-50",
              isChosen ? "border-primary" : "border-default",
            )}
          >
            <span
              aria-hidden="true"
              className="size-7 rounded-full"
              style={{
                background: `linear-gradient(135deg, ${preset.primaryColor} 50%, ${preset.accentColor} 50%)`,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

function ContrastMessage(props: {
  check: ColourCheck;
  labels: BrandingLabels;
}): ReactElement | null {
  const { check, labels } = props;
  if (check.status === "ok") {
    return (
      <p className="text-small text-success">
        {fillTemplate(labels.contrastOk, { ratio: check.ratio })}
      </p>
    );
  }
  if (check.status === "low") {
    return (
      <p className="text-small text-danger">
        {fillTemplate(labels.contrastLow, { ratio: check.ratio })}
      </p>
    );
  }
  return null;
}

interface ColourBoxProps {
  kind: ColourKind;
  fieldId: string;
  value: string;
  texts: ColourLabels;
  errorKey: string | undefined;
  disabled: boolean;
  labels: BrandingLabels;
  errorText: (messageKey: string) => string;
  onChange: (value: string) => void;
}

function describedBy(fieldId: string, hasError: boolean): string {
  const ids = [formFieldMessageId(fieldId, "hint")];
  if (hasError) ids.push(formFieldMessageId(fieldId, "error"));
  return ids.join(" ");
}

/** One colour: a native picker, a hex box and the live contrast message (the same rule as the API). */
function ColourBox(props: ColourBoxProps): ReactElement {
  const { kind, fieldId, value, texts, errorKey, disabled, labels } = props;
  const check = checkColour(kind, value);
  const isCode = check.status === "ok" || check.status === "low";
  const isMarked = check.status === "invalid" || check.status === "low" || errorKey !== undefined;
  return (
    <FormField
      label={texts.name}
      htmlFor={fieldId}
      hint={texts.hint}
      error={errorKey ? props.errorText(errorKey) : undefined}
    >
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={fillTemplate(labels.pickerFor, { name: texts.name })}
          value={isCode ? value.trim() : FALLBACK_PICKER_COLOUR}
          disabled={disabled}
          onChange={(event) => props.onChange(event.target.value)}
          className="size-11 shrink-0 cursor-pointer rounded-sm border border-default bg-surface p-1 disabled:opacity-50"
        />
        <TextInput
          id={fieldId}
          value={value}
          disabled={disabled}
          placeholder="#0f766e"
          maxLength={7}
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={isMarked}
          aria-describedby={describedBy(fieldId, errorKey !== undefined)}
          onChange={(event) => props.onChange(event.target.value)}
        />
        {value === "" || disabled ? null : (
          <Button variant="ghost" onClick={() => props.onChange("")}>
            {labels.clearColour}
          </Button>
        )}
      </div>
      <ContrastMessage check={check} labels={labels} />
    </FormField>
  );
}

/** Presets first, "Custom" second (plan 3.12 decision 6). */
export function ColourFields(props: ColourFieldsProps): ReactElement {
  const { state, errors, disabled, labels, errorText, onChange } = props;
  const [isCustomOpen, setIsCustomOpen] = useState(
    state.primaryColor !== "" && matchingPresetKey(state) === undefined,
  );
  return (
    <div className="flex flex-col gap-4">
      <PresetSwatches {...props} />
      <div>
        <Button
          variant="secondary"
          aria-expanded={isCustomOpen}
          onClick={() => setIsCustomOpen(!isCustomOpen)}
        >
          {labels.custom}
        </Button>
      </div>
      {isCustomOpen ? (
        <div className="grid gap-4 md:grid-cols-2">
          <ColourBox
            kind="primary"
            fieldId="branding-primary"
            value={state.primaryColor}
            texts={labels.primary}
            errorKey={errors["primaryColor"]}
            disabled={disabled}
            labels={labels}
            errorText={errorText}
            onChange={(primaryColor) => onChange({ primaryColor })}
          />
          <ColourBox
            kind="accent"
            fieldId="branding-accent"
            value={state.accentColor}
            texts={labels.accent}
            errorKey={errors["accentColor"]}
            disabled={disabled}
            labels={labels}
            errorText={errorText}
            onChange={(accentColor) => onChange({ accentColor })}
          />
        </div>
      ) : null}
    </div>
  );
}

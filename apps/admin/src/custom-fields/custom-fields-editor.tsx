"use client";

import type { EffectiveCustomField } from "@banijjik/contracts";
import { CustomFieldInputs, currencySymbolOf } from "@banijjik/ui";
import { toFieldDescriptors, useTranslator } from "@banijjik/web-client/client";
import { useMemo, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";

export interface CustomFieldsEditorProps {
  idPrefix: string;
  /** The fields this person may fill in (`editableFieldsOf`). */
  fields: readonly EffectiveCustomField[];
  values: Readonly<Record<string, unknown>>;
  /** Message key per field key. */
  errors: Readonly<Record<string, string | undefined>>;
  currencyCode: string;
  onChange: (fieldKey: string, value: unknown) => void;
}

/** The extra-details inputs of 2.5, with the messages translated here so the form only keeps keys. */
export function CustomFieldsEditor(props: CustomFieldsEditorProps): ReactElement | null {
  const { t, locale } = useTranslator();
  const model = useMemo(
    () => toFieldDescriptors(props.fields, locale, t),
    [props.fields, locale, t],
  );
  if (props.fields.length === 0) return null;
  const messages = Object.fromEntries(
    Object.entries(props.errors).map(([fieldKey, messageKey]) => [
      fieldKey,
      messageKey === undefined ? undefined : t(knownMessageKeyOrInternal(messageKey)),
    ]),
  );
  return (
    <CustomFieldInputs
      fields={model.fields}
      pendingFields={model.pendingFields}
      values={props.values}
      errors={messages}
      onChange={props.onChange}
      idPrefix={props.idPrefix}
      currencySymbol={currencySymbolOf(props.currencyCode)}
      chooseLabel={model.chooseLabel}
      notEditableText={model.notEditableText}
    />
  );
}

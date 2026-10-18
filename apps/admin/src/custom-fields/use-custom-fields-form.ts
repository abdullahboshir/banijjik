"use client";

import type { EffectiveCustomField } from "@banijjik/contracts";
import { useMemo, useState } from "react";
import {
  buildCustomFieldsRequest,
  customFieldErrorsOf,
  editableFieldsOf,
  initialValuesOf,
  type CustomFieldsResult,
} from "./custom-field-request";

/** What a sheet needs to offer the extra details of one entity; the server page builds it from `/me/config.fields`. */
export interface CustomFieldsFormProps {
  fields: EffectiveCustomField[];
  /** The values as the API returned them; hidden (redacted) sensitive values are absent. */
  stored: Record<string, unknown>;
  /** Whether the API shows this person sensitive values. */
  canSeeSensitive: boolean;
  currencyCode: string;
  title: string;
  /** Said when some fields are left out because this person may not read them. */
  hiddenHint: string;
  /** Names of contacts the stored values link to (contactId to name), for the contact-link input. */
  linkedNames?: Record<string, string>;
}

const NOTHING_TO_SEND: CustomFieldsResult = { ok: true, customFields: {} };

/** The state of the extra-details part of a sheet: values, errors, the request to send and the API's refusals. */
export interface CustomFieldsFormState {
  editableFields: EffectiveCustomField[];
  values: Record<string, unknown>;
  /** Message key per field key. */
  errors: Record<string, string>;
  /** True when some fields are left out because this person may not read them. */
  hasHiddenFields: boolean;
  setValue: (fieldKey: string, value: unknown) => void;
  /** Checks the form and returns the changed details to send, or sets the errors. */
  buildRequest: () => CustomFieldsResult;
  showRefusal: (details: Readonly<Record<string, unknown>> | undefined) => void;
}

export function useCustomFieldsForm(
  props: CustomFieldsFormProps | undefined,
): CustomFieldsFormState {
  const editableFields = useMemo(
    () => (props === undefined ? [] : editableFieldsOf(props.fields, props.canSeeSensitive)),
    [props],
  );
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    props === undefined ? {} : initialValuesOf(props),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function buildRequest(): CustomFieldsResult {
    if (props === undefined) return NOTHING_TO_SEND;
    const result = buildCustomFieldsRequest({ ...props, values });
    setErrors(result.ok ? {} : result.errors);
    return result;
  }

  return {
    editableFields,
    values,
    errors,
    hasHiddenFields: props !== undefined && editableFields.length < visibleCount(props),
    setValue: (fieldKey: string, value: unknown) =>
      setValues((current) => ({ ...current, [fieldKey]: value })),
    buildRequest,
    showRefusal: (details: Readonly<Record<string, unknown>> | undefined) =>
      setErrors(customFieldErrorsOf(details)),
  };
}

function visibleCount(props: CustomFieldsFormProps): number {
  return props.fields.filter((field) => field.visibility.admin).length;
}

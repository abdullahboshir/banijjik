import { useTranslator } from "@banijjik/web-client/client";
import type { Translator } from "@banijjik/i18n";
import { useState, type FormEvent } from "react";
import { ApiError } from "../lib/api/api-error";
import type { FieldErrors } from "./field-errors";
import { mapApiError, type FormMessage, type MappedApiError } from "./map-api-error";

type FormValues = Record<string, string>;

export interface AuthFormOptions<Values extends FormValues> {
  initialValues: Values;
  /** The shared Zod schemas of the API, as message keys per field. */
  validate: (values: Values) => FieldErrors;
  /** Throws an ApiError when the API refuses; navigates itself when it accepts. */
  submit: (values: Values) => Promise<void>;
}

export interface AuthForm<Values extends FormValues> {
  values: Values;
  /** Already translated, one per field. */
  fieldErrors: Partial<Record<keyof Values, string>>;
  formError: string | undefined;
  isSubmitting: boolean;
  setValue: (field: keyof Values & string, value: string) => void;
  validateField: (field: keyof Values & string) => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

const INTERNAL_MESSAGE: FormMessage = { messageKey: "errors.internal" };

/** Runs the submit and turns any refusal into something the form can show. Resolves undefined on success. */
async function submitSafely<Values extends FormValues>(
  options: AuthFormOptions<Values>,
  values: Values,
): Promise<MappedApiError | undefined> {
  try {
    await options.submit(values);
    return undefined;
  } catch (error) {
    if (error instanceof ApiError) return mapApiError(error, Object.keys(options.initialValues));
    return { fieldErrors: {}, formMessage: INTERNAL_MESSAGE };
  }
}

function hasError(errors: FieldErrors): boolean {
  return Object.values(errors).some((messageKey) => messageKey !== undefined);
}

function translateFieldErrors<Values extends FormValues>(
  errorKeys: FieldErrors,
  t: Translator["t"],
): Partial<Record<keyof Values, string>> {
  const fieldErrors: Partial<Record<keyof Values, string>> = {};
  for (const [field, messageKey] of Object.entries(errorKeys)) {
    // Safe: error keys only ever come from this form's own field names.
    if (messageKey !== undefined) fieldErrors[field as keyof Values] = t(messageKey);
  }
  return fieldErrors;
}

/**
 * State of a sign-in style form: validate on blur and on submit, then submit, then place the API's refusal on
 * the right field or under the form. Text comes from the translator, never from a literal.
 */
export function useAuthForm<Values extends FormValues>(
  options: AuthFormOptions<Values>,
): AuthForm<Values> {
  const { t } = useTranslator();
  const [values, setValues] = useState(options.initialValues);
  const [errorKeys, setErrorKeys] = useState<FieldErrors>({});
  const [formMessage, setFormMessage] = useState<FormMessage | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitValues(): Promise<void> {
    setIsSubmitting(true);
    const refusal = await submitSafely(options, values);
    // On success the page is already navigating; the button stays busy until it unloads.
    if (!refusal) return;
    setIsSubmitting(false);
    setErrorKeys(refusal.fieldErrors);
    setFormMessage(refusal.formMessage);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFormMessage(undefined);
    const found = options.validate(values);
    setErrorKeys(found);
    if (!hasError(found)) void submitValues();
  }

  return {
    values,
    fieldErrors: translateFieldErrors<Values>(errorKeys, t),
    formError: formMessage ? t(formMessage.messageKey, formMessage.values) : undefined,
    isSubmitting,
    setValue: (field, value) => setValues((previous) => ({ ...previous, [field]: value })),
    validateField: (field) =>
      setErrorKeys((previous) => ({ ...previous, [field]: options.validate(values)[field] })),
    handleSubmit,
  };
}

import { useState } from "react";
import { useTranslator } from "../i18n/i18n-provider";
import { failureOf, type FormFailure } from "./api-failure";

export interface FormSubmit {
  isSubmitting: boolean;
  failure: FormFailure | undefined;
  /** Runs the API call; resolves true when it worked, false when the API refused (the failure is then set). */
  run: (action: () => Promise<unknown>) => Promise<boolean>;
}

/** Busy state and refusal of one form submit. Text comes from the translator, never from a literal. */
export function useFormSubmit(): FormSubmit {
  const { has } = useTranslator();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failure, setFailure] = useState<FormFailure | undefined>();

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setIsSubmitting(true);
    setFailure(undefined);
    try {
      await action();
      return true;
    } catch (error) {
      setFailure(failureOf(error, has));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  return { isSubmitting, failure, run };
}

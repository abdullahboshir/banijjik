"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FieldErrors } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { failureOfApiError, NO_FAILURE, type FormFailure } from "./form-failure";

/** What a sheet's `send` says: it went through, or the form itself found field errors and sent nothing. */
export type SheetSendResult = { ok: true } | { ok: false; fieldErrors: FieldErrors };

export const DEFAULT_ACTION = "save";

export interface SheetSubmitOptions {
  /** The form's own field names, to tell which API field errors belong to it. */
  fieldNames: readonly string[];
  onClose: () => void;
  /** `action` is what the person pressed; most sheets have only "save". */
  send: (action: string) => Promise<SheetSendResult>;
}

export interface SheetSubmitState {
  errors: FieldErrors;
  failure: FormFailure;
  isSaving: boolean;
  submit: (action?: string) => Promise<void>;
  reload: () => void;
}

/**
 * The submit cycle every settings sheet shares: field errors from the form or the API, a 409 with a
 * reload hint, and any other refusal (403, 422) as the message key the API sent. On success the sheet
 * closes and the page is read again.
 */
export function useSheetSubmit(options: SheetSubmitOptions): SheetSubmitState {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<FormFailure>(NO_FAILURE);
  const [isSaving, setIsSaving] = useState(false);

  async function submit(action = DEFAULT_ACTION): Promise<void> {
    setErrors({});
    setFailure(NO_FAILURE);
    setIsSaving(true);
    try {
      const result = await options.send(action);
      if (result.ok) {
        options.onClose();
        router.refresh();
        return;
      }
      setErrors(result.fieldErrors);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      const refused = failureOfApiError(error, options.fieldNames);
      setErrors(refused.fieldErrors);
      setFailure(refused);
    }
    setIsSaving(false);
  }

  return { errors, failure, isSaving, submit, reload: () => router.refresh() };
}

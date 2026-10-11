import { ERROR_CODE } from "@banijjik/contracts";
import { mapApiError, type FormMessage } from "../auth/map-api-error";
import type { FieldErrors } from "../auth/field-errors";
import type { ApiError } from "../lib/api/api-error";

/** How one refused submit of a settings form is shown: on a field, as a conflict, as a limit or under the form. */
export interface FormFailure {
  /** Someone else changed the record (409): the person reloads and tries again. */
  isConflict: boolean;
  /** The package allows no more of this (422 LIMIT_REACHED): the screen shows its own explanation. */
  isLimit: boolean;
  fieldErrors: FieldErrors;
  formMessage?: FormMessage;
}

export const NO_FAILURE: FormFailure = { isConflict: false, isLimit: false, fieldErrors: {} };

/** Sorts an API refusal into the places a settings form can show it; `fieldNames` are the form's own fields. */
export function failureOfApiError(error: ApiError, fieldNames: readonly string[]): FormFailure {
  if (error.code === ERROR_CODE.CONFLICT) return { ...NO_FAILURE, isConflict: true };
  if (error.code === ERROR_CODE.LIMIT_REACHED) return { ...NO_FAILURE, isLimit: true };
  const mapped = mapApiError(error, fieldNames);
  return {
    ...NO_FAILURE,
    fieldErrors: mapped.fieldErrors,
    ...(mapped.formMessage ? { formMessage: mapped.formMessage } : {}),
  };
}

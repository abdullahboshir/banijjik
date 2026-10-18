"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { knownMessageKeyOrInternal, type FieldErrors } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { updateProfile } from "../profile/profile-api";
import { failureOfApiError, NO_FAILURE, type FormFailure } from "../settings/form-failure";
import { buildBrandingUpdate, type BrandingFormState } from "./branding-state";

const PATH_PREFIX = "branding.";

export interface BrandingSaveInput {
  organizationId: string;
  /** The version the page was drawn from; a stale one is refused with a 409. */
  version: number;
  initial: BrandingFormState;
  current: BrandingFormState;
  /** The toast text after a successful save. */
  savedMessage: string;
}

export interface BrandingSave {
  errors: FieldErrors;
  failure: FormFailure;
  isSaving: boolean;
  save: () => Promise<void>;
  reload: () => void;
}

/** The API names a refused branding key `branding.<key>`; the form places it on that key's box. */
function brandingFieldErrors(error: ApiError): FieldErrors {
  const fields: unknown = error.details?.["fields"];
  if (!Array.isArray(fields)) return {};
  const errors: FieldErrors = {};
  for (const field of fields) {
    // The API sends `fields` as untyped JSON; only entries with two strings are used.
    const { path, messageKey } = field as { path?: unknown; messageKey?: unknown };
    if (typeof path !== "string" || typeof messageKey !== "string") continue;
    if (path.startsWith(PATH_PREFIX)) {
      errors[path.slice(PATH_PREFIX.length)] ??= knownMessageKeyOrInternal(messageKey);
    }
  }
  return errors;
}

/** Saves the branding with the profile endpoint: field errors on their boxes, a 409 with a reload hint. */
export function useBrandingSave(input: BrandingSaveInput): BrandingSave {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<FormFailure>(NO_FAILURE);
  const [isSaving, setIsSaving] = useState(false);

  async function save(): Promise<void> {
    setFailure(NO_FAILURE);
    const built = buildBrandingUpdate(input.current, input.initial);
    setErrors(built.ok ? {} : built.fieldErrors);
    if (!built.ok || built.branding === undefined) return;
    setIsSaving(true);
    try {
      await updateProfile(input.organizationId, {
        version: input.version,
        branding: built.branding,
      });
      // The toast library loads on demand, like the Toaster itself (13-UX section 11).
      const { toast } = await import("@banijjik/ui/toast");
      toast.success(input.savedMessage);
      router.refresh();
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      const placed = error.code === ERROR_CODE.VALIDATION_ERROR ? brandingFieldErrors(error) : {};
      const hasPlaced = Object.keys(placed).length > 0;
      setErrors(placed);
      setFailure(hasPlaced ? NO_FAILURE : failureOfApiError(error, []));
    }
    setIsSaving(false);
  }

  return { errors, failure, isSaving, save, reload: () => router.refresh() };
}

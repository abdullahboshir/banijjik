"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FieldErrors } from "../auth/field-errors";
import type { FormFailure } from "../settings/form-failure";
import type { BrandingFormState } from "./branding-state";

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
  /** Absent while all is well, and when every refusal sits on a box. */
  failure: FormFailure | undefined;
  isSaving: boolean;
  save: () => Promise<void>;
  reload: () => void;
}

/** Saves the branding with the profile endpoint: field errors on their boxes, a 409 with a reload hint. */
export function useBrandingSave(input: BrandingSaveInput): BrandingSave {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<FormFailure | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  async function save(): Promise<void> {
    setIsSaving(true);
    setFailure(undefined);
    // The save code loads on the first click, so the page's first scripts stay small (13-UX section 11).
    const { saveBranding } = await import("./branding-actions");
    const outcome = await saveBranding(input);
    if (outcome.kind === "saved") {
      // The toast library loads on demand, like the Toaster itself.
      const { toast } = await import("@banijjik/ui/toast");
      toast.success(input.savedMessage);
      setErrors({});
      router.refresh();
    } else if (outcome.kind === "refused") {
      setErrors(outcome.errors);
      setFailure(outcome.failure);
    }
    setIsSaving(false);
  }

  return { errors, failure, isSaving, save, reload: () => router.refresh() };
}

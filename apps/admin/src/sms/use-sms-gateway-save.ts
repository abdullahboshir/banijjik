"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormFailure } from "../settings/form-failure";
import type { SmsGatewayView } from "./sms-api";
import type { SmsSettingsLabels } from "./sms-labels";
import { saveSmsSettings } from "./sms-save";
import { buildSmsGatewayBody, type SmsFormState } from "./sms-state";

export interface SmsGatewaySave {
  failure: FormFailure | undefined;
  /** True after a refusal because an enabled provider is missing a field. */
  isIncomplete: boolean;
  isSaving: boolean;
  save: () => Promise<void>;
  reload: () => void;
}

/** Saves the form through the API: a toast and a refresh on success, the refusal on the form otherwise. */
export interface SmsGatewaySaveInput {
  organizationId: string;
  state: SmsFormState;
  view: SmsGatewayView;
  labels: SmsSettingsLabels;
}

export function useSmsGatewaySave({
  organizationId,
  state,
  view,
  labels,
}: SmsGatewaySaveInput): SmsGatewaySave {
  const router = useRouter();
  const [failure, setFailure] = useState<FormFailure | undefined>();
  const [isIncomplete, setIsIncomplete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function save(): Promise<void> {
    setIsSaving(true);
    setFailure(undefined);
    setIsIncomplete(false);
    const outcome = await saveSmsSettings(organizationId, buildSmsGatewayBody(state, view));
    if (outcome.kind === "saved") {
      // The toast library loads on demand, like the Toaster itself.
      const { toast } = await import("@banijjik/ui/toast");
      toast.success(labels.saved);
      router.refresh();
    } else if (outcome.kind === "incomplete") {
      setIsIncomplete(true);
    } else {
      setFailure(outcome.failure);
    }
    setIsSaving(false);
  }

  return { failure, isIncomplete, isSaving, save, reload: () => router.refresh() };
}

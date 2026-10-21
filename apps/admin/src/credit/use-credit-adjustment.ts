"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { useTranslator } from "@banijjik/web-client/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { adjustCredits } from "./credit-api";
import { adjustBodyOf, EMPTY_ADJUST_DRAFT, type AdjustDraft } from "./credit-form";
import type { ContactCreditsLabels } from "./credit-labels";
import { useCreditApproval, type CreditApproval } from "./use-credit-approval";

export interface CreditAdjustment {
  draft: AdjustDraft;
  setDraft: (draft: AdjustDraft) => void;
  locationId: string;
  setLocationId: (locationId: string) => void;
  isBusy: boolean;
  formError: string | undefined;
  notice: string | undefined;
  approval: CreditApproval;
  submit: () => Promise<void>;
}

type AdjustmentOutcome =
  | { kind: "done" }
  | { kind: "invalid" }
  | { kind: "refused"; message: string }
  | { kind: "approval"; refusal: string | undefined };

async function submitAdjustment(input: {
  organizationId: string;
  customerAccountId: string;
  draft: AdjustDraft;
  locationId: string;
  isOwner: boolean;
  approval: CreditApproval;
  refusalTextOf: (error: ApiError) => string;
}): Promise<AdjustmentOutcome> {
  const body = adjustBodyOf(input.draft);
  if (body === undefined) return { kind: "invalid" };
  try {
    await adjustCredits(input.organizationId, input.customerAccountId, body);
    return { kind: "done" };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.code === ERROR_CODE.APPROVAL_REQUIRED && !input.isOwner) {
      return { kind: "approval", refusal: await input.approval.open(body, input.locationId) };
    }
    return { kind: "refused", message: input.refusalTextOf(error) };
  }
}

/** The adjustment form's state: the owner sends it directly, everyone else goes through a PIN. */
export function useCreditAdjustment(props: {
  organizationId: string;
  customerAccountId: string;
  isOwner: boolean;
  locations: readonly { locationId: string }[];
  labels: ContactCreditsLabels;
}): CreditAdjustment {
  const { t } = useTranslator();
  const router = useRouter();
  const [draft, setDraft] = useState<AdjustDraft>(EMPTY_ADJUST_DRAFT);
  const [locationId, setLocationId] = useState(props.locations[0]?.locationId ?? "");
  const [isBusy, setIsBusy] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  function finishAdjustment(): void {
    setDraft(EMPTY_ADJUST_DRAFT);
    setFormError(undefined);
    setNotice(props.labels.adjusted);
    router.refresh();
  }
  const approval = useCreditApproval({
    organizationId: props.organizationId,
    customerAccountId: props.customerAccountId,
    noApproversLabel: props.labels.noApprovers,
    onAdjusted: finishAdjustment,
  });
  async function submit(): Promise<void> {
    setNotice(undefined);
    setFormError(undefined);
    setIsBusy(true);
    try {
      const outcome = await submitAdjustment({
        organizationId: props.organizationId,
        customerAccountId: props.customerAccountId,
        draft,
        locationId,
        isOwner: props.isOwner,
        approval,
        refusalTextOf: (error) => t(knownMessageKeyOrInternal(error.messageKey)),
      });
      if (outcome.kind === "invalid") setFormError(props.labels.invalid);
      else if (outcome.kind === "refused") setFormError(outcome.message);
      else if (outcome.kind === "approval") setFormError(outcome.refusal);
      else finishAdjustment();
    } finally {
      setIsBusy(false);
    }
  }
  return {
    draft,
    setDraft,
    locationId,
    setLocationId,
    isBusy,
    formError,
    notice,
    approval,
    submit,
  };
}

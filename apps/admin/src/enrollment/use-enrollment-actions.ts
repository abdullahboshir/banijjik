"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/catalog";
import { ENROLLMENT_RULE_KEY } from "@banijjik/contracts/enrollment";
import { newId } from "@banijjik/ids";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { transitionEnrollment } from "./enrollment-api";
import { ENROLLMENT_ACTION_KEY, type EnrollmentActionKey } from "./enrollment-action-items";

export interface EnrollmentActionFailure {
  /** A catalog key: the rule key the API sent. */
  readonly messageKey: string;
  /** Someone else changed the enrollment (409): the person reloads and tries again. */
  readonly isConflict: boolean;
  readonly isPaymentRequired: boolean;
}

export interface CancelOutcome {
  readonly refundableAmount: Money | undefined;
  /** What each period may still give back, as the cancel fixed it (3.32). */
  readonly refundableByPeriod: readonly { enrollmentPeriodId: string; amount: Money }[];
}

function failureOf(error: unknown): EnrollmentActionFailure {
  if (!(error instanceof ApiError)) throw error;
  return {
    messageKey: knownMessageKeyOrInternal(error.messageKey),
    isConflict: error.code === ERROR_CODE.CONFLICT,
    isPaymentRequired: error.messageKey === ENROLLMENT_RULE_KEY.PAYMENT_REQUIRED,
  };
}

export interface EnrollmentActionsModel {
  readonly isBusy: boolean;
  readonly failure: EnrollmentActionFailure | undefined;
  readonly cancelOutcome: CancelOutcome | undefined;
  readonly run: (action: EnrollmentActionKey) => Promise<void>;
  readonly reload: () => void;
}

export function useEnrollmentActions(input: {
  organizationId: string;
  enrollmentId: string;
  version: number;
}): EnrollmentActionsModel {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [failure, setFailure] = useState<EnrollmentActionFailure | undefined>(undefined);
  const [cancelOutcome, setCancelOutcome] = useState<CancelOutcome | undefined>(undefined);

  async function run(action: EnrollmentActionKey): Promise<void> {
    setIsBusy(true);
    setFailure(undefined);
    try {
      const result = await transitionEnrollment({ ...input, action, idempotencyKey: newId() });
      if (action === ENROLLMENT_ACTION_KEY.CANCEL) {
        setCancelOutcome({
          refundableAmount: result.refundableAmount,
          refundableByPeriod: result.refundableByPeriod ?? [],
        });
        return;
      }
      router.refresh();
    } catch (error) {
      setFailure(failureOf(error));
    } finally {
      setIsBusy(false);
    }
  }

  return {
    isBusy,
    failure,
    cancelOutcome,
    run,
    reload: () => router.refresh(),
  };
}

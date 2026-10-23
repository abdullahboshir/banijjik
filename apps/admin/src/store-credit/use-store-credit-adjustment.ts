"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { APPROVAL_ACTION, type ApproverSummary } from "@banijjik/contracts/iam";
import { newId } from "@banijjik/ids";
import { parseMoneyInput } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import {
  adjustStoreCredit,
  grantApproval,
  listApprovers,
  type StoreCreditAdjustment,
} from "./store-credit-api";
import type { StoreCreditProps } from "./store-credit-types";

interface PendingAdjustment {
  body: StoreCreditAdjustment;
  locationId: string;
  idempotencyKey: string;
  approvalToken?: string;
}

function useAdjustmentState(props: StoreCreditProps) {
  const router = useRouter();
  const { t } = useTranslator();
  const [pending, setPending] = useState<PendingAdjustment>();
  const [approvers, setApprovers] = useState<ApproverSummary[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [notice, setNotice] = useState<string>();

  function report(failure: unknown) {
    if (!(failure instanceof ApiError)) throw failure;
    setLocked(failure.code === ERROR_CODE.APPROVAL_PIN_LOCKED);
    setError(
      failure.status === 409
        ? props.labels.conflict
        : t(knownMessageKeyOrInternal(failure.messageKey)),
    );
  }

  return {
    pending,
    approvers,
    error,
    busy,
    locked,
    notice,
    setPending,
    setApprovers,
    setError,
    setBusy,
    setLocked,
    setNotice,
    report,
    router,
    close: () => {
      if (!busy) {
        setPending(undefined);
        setError(undefined);
      }
    },
  };
}

export interface StoreCreditAdjustmentState {
  pending: PendingAdjustment | undefined;
  approvers: ApproverSummary[];
  error: string | undefined;
  busy: boolean;
  locked: boolean;
  notice: string | undefined;
  open: (input: AdjustmentDraft) => Promise<void>;
  approve: (input: { approverMemberId: string; pin: string }) => Promise<void>;
  close: () => void;
}
interface AdjustmentDraft {
  amount: string;
  reason: string;
  direction: StoreCreditAdjustment["direction"];
  locationId: string;
}

async function openAdjustment(
  props: StoreCreditProps,
  state: ReturnType<typeof useAdjustmentState>,
  input: AdjustmentDraft,
): Promise<void> {
  state.setError(undefined);
  state.setNotice(undefined);
  const parsed = parseMoneyInput(input.amount, 2);
  if (
    !parsed ||
    parsed.minorUnits <= 0 ||
    !input.reason.trim() ||
    input.reason.trim().length > 200 ||
    !props.locations.some((location) => location.locationId === input.locationId)
  ) {
    state.setError(props.labels.invalid);
    return;
  }
  state.setBusy(true);
  try {
    const listed = await listApprovers(props.organizationId, input.locationId);
    if (listed.length === 0) {
      state.setError(props.labels.noApprovers);
      return;
    }
    state.setApprovers(listed);
    state.setLocked(false);
    state.setPending({
      body: {
        contactId: props.contactId,
        amount: { amount: parsed.minorUnits, currency: props.currency },
        direction: input.direction,
        reason: input.reason.trim(),
      },
      locationId: input.locationId,
      idempotencyKey: newId(),
    });
  } catch (failure) {
    state.report(failure);
  } finally {
    state.setBusy(false);
  }
}

async function approveAdjustment(
  props: StoreCreditProps,
  state: ReturnType<typeof useAdjustmentState>,
  input: { approverMemberId: string; pin: string },
): Promise<void> {
  const { pending, busy } = state;
  if (!pending || busy) return;
  state.setBusy(true);
  state.setError(undefined);
  state.setLocked(false);
  try {
    const approvalToken = await tokenForAdjustment(props, pending, input);
    // A lost response must retry the identical body and key, including its one-time token.
    state.setPending({ ...pending, approvalToken });
    await adjustStoreCredit(
      props.organizationId,
      { ...pending.body, approvalToken },
      pending.idempotencyKey,
    );
    state.setPending(undefined);
    state.setNotice(props.labels.adjusted);
    state.router.refresh();
  } catch (failure) {
    state.report(failure);
  } finally {
    state.setBusy(false);
  }
}

async function tokenForAdjustment(
  props: StoreCreditProps,
  pending: PendingAdjustment,
  input: { approverMemberId: string; pin: string },
): Promise<string> {
  if (pending.approvalToken) return pending.approvalToken;
  const grant = await grantApproval(props.organizationId, {
    ...input,
    action: APPROVAL_ACTION.STORE_CREDIT_ADJUSTMENT,
    subjectKey: props.contactId,
    locationId: pending.locationId,
    amount: pending.body.amount,
  });
  return grant.approvalToken;
}

export function useStoreCreditAdjustment(props: StoreCreditProps): StoreCreditAdjustmentState {
  const state = useAdjustmentState(props);
  return {
    ...state,
    open: (input) => openAdjustment(props, state, input),
    approve: (input) => approveAdjustment(props, state, input),
  };
}

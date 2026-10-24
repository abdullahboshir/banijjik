import type { Money } from "@banijjik/contracts/accounting";
import {
  COMMISSION_API_MESSAGE_KEYS,
  type CommissionPayoutMethod,
  type CommissionPayoutPreviewResponse,
} from "@banijjik/contracts/commission";
import { newId } from "@banijjik/ids";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { mapApiError } from "../auth/map-api-error";
import { keyForSubmit, type KeyedSubmit } from "../invitations/idempotency-keeper";
import { ApiError } from "../lib/api/api-error";
import { NO_FAILURE, type FormFailure } from "../settings/form-failure";
import { createCommissionPayout, previewCommissionPayout } from "./commission-api";
import type { CommissionPaySheetProps } from "./commission-pay-sheet";
import {
  buildPayoutBody,
  needsPayoutReference,
  totalFromDetails,
  validatePayoutForm,
} from "./commission-pay-form";
import type { FieldErrors } from "../auth/field-errors";

export interface PayFormState {
  memberId: string;
  locationId: string;
  upTo: string;
  method: CommissionPayoutMethod;
  externalReference: string;
  note: string;
}
export interface PayFormController {
  form: PayFormState;
  patch: (changes: Partial<PayFormState>) => void;
  preview: CommissionPayoutPreviewResponse | undefined;
  expectedTotal: Money | undefined;
  changedTotal: Money | undefined;
  errors: FieldErrors;
  failure: FormFailure;
  isPreviewing: boolean;
  isSaving: boolean;
  runPreview: () => Promise<void>;
  confirm: () => Promise<void>;
}
type SetErrors = (errors: FieldErrors) => void;
type SetFailure = (failure: FormFailure) => void;

interface PayTotals {
  preview: CommissionPayoutPreviewResponse | undefined;
  expectedTotal: Money | undefined;
  changedTotal: Money | undefined;
  isPreviewing: boolean;
  runPreview: () => Promise<void>;
  resetTotals: () => void;
  applyChangedTotal: (total: Money) => void;
}

interface PayFormContext {
  props: CommissionPaySheetProps;
  form: PayFormState;
  setErrors: SetErrors;
  setFailure: SetFailure;
}

function useCommissionPayTotals(context: PayFormContext): PayTotals {
  const { props, form, setErrors, setFailure } = context;
  const [preview, setPreview] = useState<CommissionPayoutPreviewResponse>();
  const [expectedTotal, setExpectedTotal] = useState<Money>();
  const [changedTotal, setChangedTotal] = useState<Money>();
  const [isPreviewing, setIsPreviewing] = useState(false);
  const resetTotals = () => {
    setPreview(undefined);
    setExpectedTotal(undefined);
    setChangedTotal(undefined);
  };
  const applyChangedTotal = (total: Money) => {
    setPreview(undefined);
    setChangedTotal(total);
    setExpectedTotal(total);
  };
  const runPreview = async () => {
    const localErrors = validatePayoutForm(form, false);
    setErrors(localErrors);
    if (Object.keys(localErrors).length) return;
    setFailure(NO_FAILURE);
    setIsPreviewing(true);
    try {
      const result = await previewCommissionPayout(props.organizationId, {
        memberId: form.memberId,
        location: form.locationId,
        upTo: form.upTo,
      });
      setPreview(result);
      setExpectedTotal(result.total);
      setChangedTotal(undefined);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      setErrors(mapApiError(error, ["memberId", "locationId", "upToBusinessDate"]).fieldErrors);
      setFailure({ ...NO_FAILURE, isConflict: error.code === "CONFLICT" });
    } finally {
      setIsPreviewing(false);
    }
  };
  return {
    preview,
    expectedTotal,
    changedTotal,
    isPreviewing,
    runPreview,
    resetTotals,
    applyChangedTotal,
  };
}

function failureOfSubmitError(error: ApiError): FormFailure {
  return {
    ...NO_FAILURE,
    isConflict: error.code === "CONFLICT",
    fieldErrors: mapApiError(error, [
      "memberId",
      "locationId",
      "upToBusinessDate",
      "externalReference",
    ]).fieldErrors,
  };
}

function useCommissionPaySubmit(
  context: PayFormContext,
  totals: PayTotals,
): { isSaving: boolean; confirm: () => Promise<void> } {
  const { props, form, setErrors, setFailure } = context;
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const lastSubmit = useRef<KeyedSubmit | undefined>(undefined);
  const handleSubmitError = (error: unknown) => {
    if (!(error instanceof ApiError)) throw error;
    const total = totalFromDetails(error.details, props.currency);
    if (error.messageKey === COMMISSION_API_MESSAGE_KEYS.payoutTotalChanged && total) {
      totals.applyChangedTotal(total);
      setErrors({});
      return;
    }
    setFailure(failureOfSubmitError(error));
  };
  const confirm = async () => {
    if (!totals.expectedTotal) return;
    const localErrors = validatePayoutForm(form, needsPayoutReference(form.method));
    setErrors(localErrors);
    if (Object.keys(localErrors).length) return;
    setFailure(NO_FAILURE);
    setIsSaving(true);
    const body = buildPayoutBody(form, totals.expectedTotal);
    lastSubmit.current = keyForSubmit(lastSubmit.current, JSON.stringify(body), newId);
    try {
      await createCommissionPayout(props.organizationId, body, lastSubmit.current.key);
      lastSubmit.current = undefined;
      props.onClose();
      router.refresh();
    } catch (error) {
      handleSubmitError(error);
    } finally {
      setIsSaving(false);
    }
  };
  return { isSaving, confirm };
}

function initialPayForm(props: CommissionPaySheetProps): PayFormState {
  return {
    memberId: props.defaultMemberId ?? props.members[0]?.memberId ?? "",
    locationId: props.locations[0]?.locationId ?? "",
    upTo: props.defaultUpTo,
    method: "CASH" as CommissionPayoutMethod,
    externalReference: "",
    note: "",
  };
}

const PREVIEW_INPUT_KEYS = ["memberId", "locationId", "upTo"];

export function useCommissionPayForm(props: CommissionPaySheetProps): PayFormController {
  const [form, setForm] = useState<PayFormState>(() => initialPayForm(props));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<FormFailure>(NO_FAILURE);
  const context: PayFormContext = { props, form, setErrors, setFailure };
  const totals = useCommissionPayTotals(context);
  const submit = useCommissionPaySubmit(context, totals);
  const patch = (changes: Partial<PayFormState>) => {
    setForm((current) => ({ ...current, ...changes }));
    if (Object.keys(changes).some((key) => PREVIEW_INPUT_KEYS.includes(key))) totals.resetTotals();
  };
  return {
    form,
    patch,
    preview: totals.preview,
    expectedTotal: totals.expectedTotal,
    changedTotal: totals.changedTotal,
    errors,
    failure,
    isPreviewing: totals.isPreviewing,
    isSaving: submit.isSaving,
    runPreview: totals.runPreview,
    confirm: submit.confirm,
  };
}

"use client";

import type {
  ListingResponse,
  StorefrontDirectoryFormResponse,
} from "@banijjik/contracts/directory";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { callStorefront, type ClientResult, type FieldProblem } from "../api/client-api";
import { customFieldsPayload } from "../fields/field-payload";
import { missingRequiredKeys } from "../fields/field-rules";
import {
  GENERIC_TEXT_KEY,
  useListingFormErrors,
  type ListingFormErrors,
} from "./listing-form-errors";
import { firstStepWithMissing, listingStepsOf, type ListingStep } from "./listing-steps";

const HTTP_CONFLICT = 409;
const CONFLICT_PATH = "/my/listing?conflict=1";
const SUBMITTED_TEXT_KEY = "storefront.account.submitted";

export interface ListingFormInput {
  readonly organizationId: string;
  readonly form: StorefrontDirectoryFormResponse;
  readonly listing: ListingResponse | undefined;
}

export interface ListingFormState {
  readonly steps: readonly ListingStep[];
  readonly stepIndex: number;
  readonly values: Readonly<Record<string, unknown>>;
  /** Field key to a storefront text key. */
  readonly errors: Readonly<Record<string, string>>;
  readonly consentKeys: readonly string[];
  readonly notice: string | undefined;
  readonly isBusy: boolean;
  readonly status: ListingResponse["status"] | undefined;
  readonly setValue: (fieldKey: string, value: unknown) => void;
  readonly toggleConsent: (consentKey: string) => void;
  readonly next: () => Promise<void>;
  readonly back: () => void;
  readonly submit: () => Promise<void>;
}

interface DraftRequest {
  readonly organizationId: string;
  readonly form: StorefrontDirectoryFormResponse;
  readonly values: Readonly<Record<string, unknown>>;
  readonly version: number;
}

/** The answer of one save: the saved listing, a conflict, or the API's field problems. */
type SaveOutcome =
  | { readonly kind: "saved"; readonly listing: ListingResponse | undefined }
  | { readonly kind: "conflict" }
  | { readonly kind: "failed"; readonly problems: readonly FieldProblem[] };

async function putDraft(request: DraftRequest): Promise<ClientResult<ListingResponse>> {
  return callStorefront<ListingResponse>("PUT", `/orgs/${request.organizationId}/my/listing`, {
    body: {
      customFields: customFieldsPayload(request.form.fields, request.values),
      ...(request.version === 0 ? {} : { version: request.version }),
    },
  });
}

async function saveDraftCall(request: DraftRequest): Promise<SaveOutcome> {
  const result = await putDraft(request);
  if (result.status === HTTP_CONFLICT) return { kind: "conflict" };
  if (!result.ok) return { kind: "failed", problems: result.fields };
  return { kind: "saved", listing: result.data };
}

async function submitCall(
  organizationId: string,
  consentKeys: readonly string[],
): Promise<ClientResult<ListingResponse>> {
  return callStorefront<ListingResponse>("POST", `/orgs/${organizationId}/my/listing/submit`, {
    body: { consents: consentKeys.map((consentKey) => ({ consentKey })) },
  });
}

/** The answers, the step being shown, the consents and the save status of the form. */
function useListingDraft(input: ListingFormInput) {
  const { listing } = input;
  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState<Record<string, unknown>>(listing?.customFields ?? {});
  const [consentKeys, setConsentKeys] = useState<readonly string[]>([]);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState<ListingResponse["status"] | undefined>(listing?.status);
  const [version, setVersion] = useState(listing?.version ?? 0);
  return {
    stepIndex,
    setStepIndex,
    values,
    setValues,
    consentKeys,
    setConsentKeys,
    notice,
    setNotice,
    isBusy,
    setIsBusy,
    status,
    setStatus,
    version,
    setVersion,
  };
}

type DraftState = ReturnType<typeof useListingDraft>;

/** Applies a save's outcome to the form state; a conflict reloads the page with its message. */
interface SaveContext {
  readonly outcome: SaveOutcome;
  readonly draft: DraftState;
  readonly show: (problems: readonly FieldProblem[]) => void;
  readonly router: { replace: (href: string) => void };
}

function applySaveOutcome({ outcome, draft, show, router }: SaveContext): boolean {
  if (outcome.kind === "conflict") {
    router.replace(CONFLICT_PATH);
    return false;
  }
  if (outcome.kind === "failed") {
    show(outcome.problems);
    return false;
  }
  draft.setVersion(outcome.listing?.version ?? draft.version);
  draft.setStatus(outcome.listing?.status);
  return true;
}

/** The form's answers, the step being shown, and the calls: save the draft, then submit it. */
export function useListingFormState(input: ListingFormInput): ListingFormState {
  const { organizationId, form } = input;
  const router = useRouter();
  const steps = listingStepsOf(form);
  const draft = useListingDraft(input);
  const formErrors = useListingFormErrors();

  const missingIn = (fieldKeys: readonly string[]): readonly string[] =>
    missingInStep(form, draft.values, fieldKeys);

  const show = (problems: readonly FieldProblem[]): void =>
    showProblems({ problems, steps, formErrors, draft });

  const saveDraft = async (): Promise<boolean> =>
    applySaveOutcome({
      outcome: await saveDraftCall({
        organizationId,
        form,
        values: draft.values,
        version: draft.version,
      }),
      draft,
      show,
      router,
    });

  const sendSubmit = async (): Promise<void> => {
    const result = await submitCall(organizationId, draft.consentKeys);
    if (!result.ok) return show(result.fields);
    draft.setStatus(result.data?.status);
    draft.setNotice(SUBMITTED_TEXT_KEY);
  };

  const run = (action: () => Promise<void>): Promise<void> => runBusy(draft, action);

  return {
    steps,
    stepIndex: draft.stepIndex,
    values: draft.values,
    errors: formErrors.errors,
    consentKeys: draft.consentKeys,
    notice: draft.notice,
    isBusy: draft.isBusy,
    status: draft.status,
    setValue: (fieldKey, value) => {
      draft.setValues((current) => ({ ...current, [fieldKey]: value }));
      formErrors.clearError(fieldKey);
    },
    toggleConsent: (consentKey) =>
      draft.setConsentKeys((current) => toggledKeys(current, consentKey)),
    next: () =>
      run(async () => {
        if (!markStepMissing({ index: draft.stepIndex, steps, missingIn, formErrors })) return;
        if (await saveDraft()) {
          draft.setStepIndex(Math.min(draft.stepIndex + 1, steps.length - 1));
        }
      }),
    back: () => draft.setStepIndex(Math.max(draft.stepIndex - 1, 0)),
    submit: () =>
      run(async () => {
        const missingStep = firstStepWithMissing(steps, missingIn);
        if (missingStep >= 0) {
          draft.setStepIndex(missingStep);
          markStepMissing({ index: missingStep, steps, missingIn, formErrors });
          return;
        }
        if (!(await saveDraft())) return;
        await sendSubmit();
      }),
  };
}

interface ProblemContext {
  readonly problems: readonly FieldProblem[];
  readonly steps: readonly ListingStep[];
  readonly formErrors: ListingFormErrors;
  readonly draft: DraftState;
}

function showProblems({ problems, steps, formErrors, draft }: ProblemContext): void {
  const shown = formErrors.showProblems(problems, steps);
  if (shown.generic) draft.setNotice(GENERIC_TEXT_KEY);
  if (shown.firstStep !== undefined) draft.setStepIndex(shown.firstStep);
}

/** The required fields of the given keys that have no answer yet. */
function missingInStep(
  form: StorefrontDirectoryFormResponse,
  values: Readonly<Record<string, unknown>>,
  fieldKeys: readonly string[],
): readonly string[] {
  const stepFields = form.fields.filter((field) => fieldKeys.includes(field.fieldKey));
  return missingRequiredKeys(stepFields, values);
}

/** The consent keys with one key switched on or off. */
function toggledKeys(current: readonly string[], key: string): readonly string[] {
  return current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
}

/** Runs one call with the busy flag on; a notice from the last call is cleared first. */
function runBusy(draft: DraftState, action: () => Promise<void>): Promise<void> {
  draft.setNotice(undefined);
  draft.setIsBusy(true);
  return action().finally(() => draft.setIsBusy(false));
}

interface MissingCheck {
  readonly index: number;
  readonly steps: readonly ListingStep[];
  readonly missingIn: (fieldKeys: readonly string[]) => readonly string[];
  readonly formErrors: ListingFormErrors;
}

/** Marks the required fields of a section step that are still empty; true when the step is complete. */
function markStepMissing(check: MissingCheck): boolean {
  const step = check.steps[check.index];
  if (step?.kind !== "section") return true;
  return check.formErrors.markMissing(check.missingIn(step.fieldKeys));
}

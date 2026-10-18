"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { OFFERING_STATUS, type Money, type OfferingResponse } from "@banijjik/contracts/catalog";
import { newId } from "@banijjik/ids";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { FieldErrors } from "../auth/field-errors";
import {
  useCustomFieldsForm,
  type CustomFieldsFormProps,
  type CustomFieldsFormState,
} from "../custom-fields/use-custom-fields-form";
import { keyForSubmit, type KeyedSubmit } from "../invitations/idempotency-keeper";
import { ApiError } from "../lib/api/api-error";
import { failureOfApiError } from "../settings/form-failure";
import {
  createOffering,
  transitionOffering,
  updateOffering,
  type OfferingBody,
} from "./offering-api";
import type { OfferingFormState } from "./offering-form";
import { buildOfferingPayload, type OfferingPayload } from "./offering-request";

const SKU_TAKEN_KEY = "errors.offering_sku_taken";
const FIELD_NAMES = [
  "name",
  "description",
  "price",
  "compareAtPrice",
  "sku",
  "quantityRule",
  "variants",
  "kindDetails",
  "categoryIds",
  "weightGrams",
  "durationMinutes",
  "bufferAfterMinutes",
  "billingCount",
  "admissionFee",
  "capacity",
  "sessionLimitPerPeriod",
  "startDates",
];

/** Why the last save was refused, when it is not a field error. */
export interface EditorFailure {
  isConflict: boolean;
  isLimit: boolean;
  /** The other offering that already uses the SKU (409), to link to. */
  skuOfferingId: string | undefined;
  messageKey: string | undefined;
}

const NO_FAILURE: EditorFailure = {
  isConflict: false,
  isLimit: false,
  skuOfferingId: undefined,
  messageKey: undefined,
};

export type SaveAction = "save" | "publish";

export interface OfferingEditorOptions {
  organizationId: string;
  orgSlug: string;
  initial: OfferingFormState;
  currency: Money["currency"];
  customFields: CustomFieldsFormProps | undefined;
}

function failureOf(error: ApiError): { failure: EditorFailure; fieldErrors: FieldErrors } {
  if (error.code === ERROR_CODE.CONFLICT && error.messageKey === SKU_TAKEN_KEY) {
    const other = error.details?.["offeringId"];
    const skuOfferingId = typeof other === "string" ? other : undefined;
    return {
      failure: { ...NO_FAILURE, skuOfferingId, messageKey: SKU_TAKEN_KEY },
      fieldErrors: {},
    };
  }
  const refused = failureOfApiError(error, FIELD_NAMES);
  return {
    failure: {
      ...NO_FAILURE,
      isConflict: refused.isConflict,
      isLimit: refused.isLimit,
      messageKey: refused.formMessage?.messageKey,
    },
    fieldErrors: refused.fieldErrors,
  };
}

function withCustomFields(
  body: OfferingPayload,
  customFields: Record<string, unknown>,
): OfferingBody {
  return Object.keys(customFields).length === 0 ? body : { ...body, customFields };
}

interface SendInput {
  organizationId: string;
  form: OfferingFormState;
  body: OfferingBody;
  action: SaveAction;
  idempotencyKey: string;
}

/** Creates or updates the offering, then publishes it when asked and it is not published yet. */
async function sendOffering(input: SendInput): Promise<OfferingResponse> {
  const { organizationId, form, body } = input;
  const saved =
    form.offeringId && form.version !== undefined
      ? await updateOffering(organizationId, {
          offeringId: form.offeringId,
          version: form.version,
          body,
        })
      : await createOffering(organizationId, {
          kind: form.kind,
          body,
          idempotencyKey: input.idempotencyKey,
        });
  if (input.action !== "publish" || saved.status === OFFERING_STATUS.ACTIVE) return saved;
  return transitionOffering(organizationId, {
    offeringId: saved.offeringId,
    version: saved.version,
    action: "publish",
  });
}

export interface OfferingEditorState {
  form: OfferingFormState;
  errors: FieldErrors;
  failure: EditorFailure;
  isSaving: boolean;
  custom: CustomFieldsFormState;
  update: (patch: Partial<OfferingFormState>) => void;
  submit: (action: SaveAction) => Promise<void>;
  reload: () => void;
}

/** The state and the save cycle of the offering editor: build, send, publish if asked, then move on. */
export function useOfferingEditor(options: OfferingEditorOptions): OfferingEditorState {
  const router = useRouter();
  const [form, setForm] = useState(options.initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<EditorFailure>(NO_FAILURE);
  const [isSaving, setIsSaving] = useState(false);
  const custom = useCustomFieldsForm(options.customFields);
  const lastSubmit = useRef<KeyedSubmit | undefined>(undefined);

  async function submit(action: SaveAction): Promise<void> {
    const built = buildOfferingPayload(form, options.currency);
    const customRequest = custom.buildRequest();
    setFailure(NO_FAILURE);
    setErrors(built.ok ? {} : built.errors);
    if (!built.ok || !customRequest.ok) return;
    setIsSaving(true);
    try {
      const body = withCustomFields(built.body, customRequest.customFields);
      lastSubmit.current = keyForSubmit(lastSubmit.current, JSON.stringify(body), newId);
      const saved = await sendOffering({
        organizationId: options.organizationId,
        form,
        body,
        action,
        idempotencyKey: lastSubmit.current.key,
      });
      lastSubmit.current = undefined;
      if (form.offeringId) router.refresh();
      else router.push(`/${options.orgSlug}/catalog/${saved.offeringId}`);
      return;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      const refused = failureOf(error);
      setFailure(refused.failure);
      setErrors(refused.fieldErrors);
      custom.showRefusal(error.details);
    }
    setIsSaving(false);
  }

  return {
    form,
    errors,
    failure,
    isSaving,
    custom,
    update: (patch: Partial<OfferingFormState>) => setForm((current) => ({ ...current, ...patch })),
    submit,
    reload: () => router.refresh(),
  };
}

"use client";

import { newId } from "@banijjik/ids";
import type { ContactLinkInputProps } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useMemo, useRef, useState } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { keyForSubmit, type KeyedSubmit } from "../invitations/idempotency-keeper";
import {
  useSheetSubmit,
  type SheetSendResult,
  type SheetSubmitState,
} from "../settings/use-sheet-submit";
import {
  contactLinkLabelsOf,
  resolveContactId,
  searchContactCandidates,
} from "./contact-link-support";
import { createEnrollment } from "./enrollment-api";
import {
  buildEnrollmentCreate,
  emptyNewEnrollmentForm,
  missingFields,
  resourcesAt,
  withPlanChosen,
  type NewEnrollmentFormState,
  type PlanChoice,
  type ResourceChoice,
} from "./new-enrollment-form";
import type { NewEnrollmentSheetProps } from "./new-enrollment-sheet";

const FIELD_NAMES = ["contact", "offeringId", "variantId", "startsOn", "locationId", "resourceIds"];

interface SendInput {
  form: NewEnrollmentFormState;
  organizationId: string;
  lastCreate: { current: KeyedSubmit | undefined };
  lastSubmit: { current: KeyedSubmit | undefined };
}

async function sendNewEnrollment(input: SendInput): Promise<SheetSendResult> {
  const { form, organizationId } = input;
  const incomplete = missingFields(form);
  if (Object.keys(incomplete).length > 0 || form.contact === null) {
    return { ok: false, fieldErrors: incomplete };
  }
  const contactId = await resolveContactId({
    organizationId,
    contact: form.contact,
    lastCreate: input.lastCreate,
  });
  const built = buildEnrollmentCreate(form, contactId);
  if (!built.ok) return { ok: false, fieldErrors: built.errors };
  input.lastSubmit.current = keyForSubmit(
    input.lastSubmit.current,
    JSON.stringify(built.body),
    () => newId(),
  );
  await createEnrollment(organizationId, built.body, input.lastSubmit.current.key);
  input.lastSubmit.current = undefined;
  return { ok: true };
}

export interface NewEnrollmentSheetModel {
  readonly form: NewEnrollmentFormState;
  readonly setForm: (form: NewEnrollmentFormState) => void;
  readonly contactLink: Pick<ContactLinkInputProps, "search" | "labels">;
  readonly state: SheetSubmitState;
  readonly errorOf: (field: string) => string | undefined;
  readonly selectedPlan: PlanChoice | undefined;
  readonly resources: readonly ResourceChoice[];
  readonly choosePlan: (offeringId: string) => void;
}

export function useNewEnrollmentSheet(props: NewEnrollmentSheetProps): NewEnrollmentSheetModel {
  const { t } = useTranslator();
  const [form, setForm] = useState<NewEnrollmentFormState>(() =>
    emptyNewEnrollmentForm({ locationId: props.locationId, today: props.today }),
  );
  const lastCreate = useRef<KeyedSubmit | undefined>(undefined);
  const lastSubmit = useRef<KeyedSubmit | undefined>(undefined);
  const contactLink = useMemo(
    () => ({
      search: searchContactCandidates(props.organizationId),
      labels: contactLinkLabelsOf(t),
    }),
    [props.organizationId, t],
  );
  const state = useSheetSubmit({
    fieldNames: FIELD_NAMES,
    onClose: props.onClose,
    send: () =>
      sendNewEnrollment({ form, organizationId: props.organizationId, lastCreate, lastSubmit }),
  });
  const errorOf = (field: string): string | undefined => {
    const key = state.errors[field];
    return key === undefined ? undefined : t(knownMessageKeyOrInternal(key));
  };
  return {
    form,
    setForm,
    contactLink,
    state,
    errorOf,
    selectedPlan: props.plans.find((plan) => plan.offeringId === form.offeringId),
    resources: resourcesAt(props.resources, form.locationId),
    choosePlan: (offeringId: string) =>
      setForm((current) =>
        withPlanChosen(
          current,
          props.plans.find((plan) => plan.offeringId === offeringId),
          props.today,
        ),
      ),
  };
}

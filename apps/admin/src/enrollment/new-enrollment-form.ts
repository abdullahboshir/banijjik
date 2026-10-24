import type { PlanStartRule } from "@banijjik/contracts/catalog";
import { PLAN_START_RULE } from "@banijjik/contracts/catalog";
import type { ContactLinkValue } from "@banijjik/ui";
import type { EnrollmentCreateBody } from "@banijjik/validation/enrollment";
import type { FieldErrors } from "../auth/field-errors";

export interface PlanChoice {
  readonly offeringId: string;
  readonly name: string;
  readonly startRule: PlanStartRule;
  readonly startDates: readonly string[];
  readonly variants: readonly { readonly variantId: string; readonly name: string }[];
}

export interface ResourceChoice {
  readonly resourceId: string;
  readonly locationId: string;
  readonly name: string;
}

export interface NewEnrollmentFormState {
  locationId: string;
  contact: ContactLinkValue | null;
  offeringId: string;
  variantId: string;
  startsOn: string;
  resourceId: string;
}

export function emptyNewEnrollmentForm(seed: {
  locationId: string;
  today: string;
}): NewEnrollmentFormState {
  return {
    locationId: seed.locationId,
    contact: null,
    offeringId: "",
    variantId: "",
    startsOn: seed.today,
    resourceId: "",
  };
}

export function usesFixedStartDates(plan: PlanChoice | undefined): boolean {
  return plan?.startRule === PLAN_START_RULE.FIXED_DATES;
}

/** Choosing another plan clears the variant and, for a fixed-date plan, the start date. */
export function withPlanChosen(
  form: NewEnrollmentFormState,
  plan: PlanChoice | undefined,
  today: string,
): NewEnrollmentFormState {
  return {
    ...form,
    offeringId: plan?.offeringId ?? "",
    variantId: "",
    startsOn: usesFixedStartDates(plan) ? "" : today,
  };
}

export function resourcesAt(
  resources: readonly ResourceChoice[],
  locationId: string,
): readonly ResourceChoice[] {
  return resources.filter((resource) => resource.locationId === locationId);
}

export function missingFields(form: NewEnrollmentFormState): FieldErrors {
  const errors: FieldErrors = {};
  if (form.contact === null) errors["contact"] = "required";
  if (form.offeringId === "") errors["offeringId"] = "required";
  if (form.variantId === "") errors["variantId"] = "required";
  if (form.startsOn === "") errors["startsOn"] = "required";
  if (form.locationId === "") errors["locationId"] = "required";
  return errors;
}

/** The create body once the contact is a saved contact; an unfinished form gives its field errors. */
export function buildEnrollmentCreate(
  form: NewEnrollmentFormState,
  contactId: string,
): { ok: true; body: EnrollmentCreateBody } | { ok: false; errors: FieldErrors } {
  const errors = missingFields(form);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    body: {
      locationId: form.locationId,
      contactId,
      offeringId: form.offeringId,
      variantId: form.variantId,
      startsOn: form.startsOn,
      resourceIds: form.resourceId === "" ? [] : [form.resourceId],
      customFields: {},
    },
  };
}

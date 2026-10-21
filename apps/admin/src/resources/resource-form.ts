import type { ResourceCreateBody, ResourceUpdateBody } from "@banijjik/validation/booking";
import type { FieldErrors } from "../auth/field-errors";
import { emptyWeekdayRows, scheduleFromRows, type WeekdayScheduleRow } from "./resource-schedule";

export interface ResourceFormState {
  locationId: string;
  resourceTypeKey: string;
  name: string;
  capacity: string;
  offeringIds: readonly string[];
  scheduleRows: WeekdayScheduleRow[];
  timeOffStartsAt: string;
  timeOffEndsAt: string;
  timeOffReason: string;
}

export function emptyResourceForm(defaults: {
  locationId: string;
  resourceTypeKey: string;
}): ResourceFormState {
  return {
    locationId: defaults.locationId,
    resourceTypeKey: defaults.resourceTypeKey,
    name: "",
    capacity: "1",
    offeringIds: [],
    scheduleRows: emptyWeekdayRows(),
    timeOffStartsAt: "",
    timeOffEndsAt: "",
    timeOffReason: "",
  };
}

export function buildResourceCreate(
  form: ResourceFormState,
): { ok: true; body: ResourceCreateBody } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  if (form.name.trim() === "") errors.name = "required";
  const capacity = Number(form.capacity);
  if (!Number.isInteger(capacity) || capacity < 1) errors.capacity = "invalid";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    body: {
      locationId: form.locationId,
      resourceTypeKey: form.resourceTypeKey,
      name: form.name.trim(),
      capacity,
      weeklySchedule: scheduleFromRows(form.scheduleRows),
      offeringIds: [...form.offeringIds],
    },
  };
}

export function buildResourceUpdate(
  form: ResourceFormState,
  version: number,
): { ok: true; body: ResourceUpdateBody } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  if (form.name.trim() === "") errors.name = "required";
  const capacity = Number(form.capacity);
  if (!Number.isInteger(capacity) || capacity < 1) errors.capacity = "invalid";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    body: {
      version,
      name: form.name.trim(),
      capacity,
      weeklySchedule: scheduleFromRows(form.scheduleRows),
      offeringIds: [...form.offeringIds],
    },
  };
}

import type { EventSessionCreateBody, EventSessionUpdateBody } from "@banijjik/validation/booking";
import type { FieldErrors } from "../auth/field-errors";
import { isoToLocalInputValue, localInputValueToIso } from "./booking-local-time";
import type { EventSessionView } from "./event-session-api";

const REQUIRED_KEY = "validation.required";
const TOO_SMALL_KEY = "validation.too_small";

export interface EventSessionFormState {
  offeringId: string;
  variantId: string;
  locationId: string;
  /** A datetime-local value: a wall time in the organization's timezone. */
  startsAtLocal: string;
  endsAtLocal: string;
  capacity: string;
}

export function emptyEventSessionForm(locationId: string): EventSessionFormState {
  return {
    offeringId: "",
    variantId: "",
    locationId,
    startsAtLocal: "",
    endsAtLocal: "",
    capacity: "",
  };
}

export function eventSessionFormOf(
  session: EventSessionView,
  timeZone: string,
): EventSessionFormState {
  return {
    offeringId: session.offeringId,
    variantId: session.variantId,
    locationId: session.locationId,
    startsAtLocal: isoToLocalInputValue(session.startsAt, timeZone),
    endsAtLocal: isoToLocalInputValue(session.endsAt, timeZone),
    capacity: String(session.capacity),
  };
}

function timingErrorsOf(form: EventSessionFormState): FieldErrors {
  const errors: FieldErrors = {};
  if (form.startsAtLocal === "") errors.startsAt = REQUIRED_KEY;
  if (form.endsAtLocal === "") errors.endsAt = REQUIRED_KEY;
  if (
    form.startsAtLocal !== "" &&
    form.endsAtLocal !== "" &&
    form.endsAtLocal <= form.startsAtLocal
  )
    errors.endsAt = TOO_SMALL_KEY;
  return errors;
}

function capacityErrorsOf(form: EventSessionFormState, soldSeats: number): FieldErrors {
  const capacity = Number(form.capacity);
  if (form.capacity.trim() === "") return { capacity: REQUIRED_KEY };
  if (!Number.isInteger(capacity) || capacity < 1 || capacity < soldSeats)
    return { capacity: TOO_SMALL_KEY };
  return {};
}

export type EventSessionBuild<Body> = { ok: true; body: Body } | { ok: false; errors: FieldErrors };

export function buildEventSessionCreate(
  form: EventSessionFormState,
  timeZone: string,
): EventSessionBuild<EventSessionCreateBody> {
  const errors: FieldErrors = { ...timingErrorsOf(form), ...capacityErrorsOf(form, 0) };
  if (form.offeringId === "") errors.offeringId = REQUIRED_KEY;
  if (form.variantId === "") errors.variantId = REQUIRED_KEY;
  if (form.locationId === "") errors.locationId = REQUIRED_KEY;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    body: {
      offeringId: form.offeringId,
      variantId: form.variantId,
      locationId: form.locationId,
      startsAt: localInputValueToIso(form.startsAtLocal, timeZone),
      endsAt: localInputValueToIso(form.endsAtLocal, timeZone),
      capacity: Number(form.capacity),
      resourceIds: [],
    },
  };
}

/**
 * Sends only what changed. The time is locked once a seat is sold (the API refuses it too), so a
 * form for a session with seats sold never carries a start or end.
 */
export function buildEventSessionUpdate(
  form: EventSessionFormState,
  session: EventSessionView,
  timeZone: string,
): EventSessionBuild<EventSessionUpdateBody> {
  const canChangeTime = session.seatsSold === 0;
  const errors: FieldErrors = {
    ...(canChangeTime ? timingErrorsOf(form) : {}),
    ...capacityErrorsOf(form, session.seatsSold),
  };
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const startsAt = localInputValueToIso(form.startsAtLocal, timeZone);
  const endsAt = localInputValueToIso(form.endsAtLocal, timeZone);
  const capacity = Number(form.capacity);
  const timeChanged = canChangeTime && (startsAt !== session.startsAt || endsAt !== session.endsAt);
  return {
    ok: true,
    body: {
      version: session.version,
      ...(timeChanged ? { startsAt, endsAt } : {}),
      ...(capacity === session.capacity ? {} : { capacity }),
    },
  };
}

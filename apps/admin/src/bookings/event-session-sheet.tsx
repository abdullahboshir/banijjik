"use client";

import { Button, FormField, Sheet, SheetContent, TextInput } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useState, type FormEvent, type ReactElement } from "react";
import type { FieldErrors } from "../auth/field-errors";
import { SheetFeedback } from "../settings/sheet-feedback";
import { useSheetSubmit, type SheetSendResult } from "../settings/use-sheet-submit";
import { createEventSession, updateEventSession, type EventSessionView } from "./event-session-api";
import {
  buildEventSessionCreate,
  buildEventSessionUpdate,
  emptyEventSessionForm,
  eventSessionFormOf,
  type EventSessionFormState,
} from "./event-session-form";

export interface EventSessionOfferingOption {
  offeringId: string;
  name: string;
  variants: readonly { variantId: string; name: string }[];
}

export interface EventSessionSheetProps {
  organizationId: string;
  timeZone: string;
  offerings: readonly EventSessionOfferingOption[];
  locations: readonly { locationId: string; name: string }[];
  defaultLocationId: string;
  existing?: EventSessionView;
  onClose: () => void;
}

type SetForm = (update: (current: EventSessionFormState) => EventSessionFormState) => void;

const SELECT_CLASS = "min-h-11 rounded-md border border-default bg-surface px-3 text-body";

async function sendSession(input: {
  props: EventSessionSheetProps;
  form: EventSessionFormState;
}): Promise<SheetSendResult> {
  const { props, form } = input;
  if (props.existing !== undefined) {
    const built = buildEventSessionUpdate(form, props.existing, props.timeZone);
    if (!built.ok) return { ok: false, fieldErrors: built.errors };
    await updateEventSession(props.organizationId, props.existing.eventSessionId, built.body);
    return { ok: true };
  }
  const built = buildEventSessionCreate(form, props.timeZone);
  if (!built.ok) return { ok: false, fieldErrors: built.errors };
  await createEventSession(props.organizationId, built.body);
  return { ok: true };
}

function useErrorText(errors: FieldErrors): (field: string) => string | undefined {
  const { t } = useTranslator();
  return (field) => {
    const key = errors[field];
    return key === undefined ? undefined : t(key);
  };
}

function SelectField(props: {
  id: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  error: string | undefined;
  hasBlank: boolean;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <FormField label={props.label} htmlFor={props.id} required error={props.error}>
      <select
        id={props.id}
        className={SELECT_CLASS}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.hasBlank ? <option value="" /> : null}
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

function SessionSelectFields(props: {
  form: EventSessionFormState;
  setForm: SetForm;
  sheet: EventSessionSheetProps;
  errors: FieldErrors;
}): ReactElement {
  const { t } = useTranslator();
  const errorOf = useErrorText(props.errors);
  const { form, setForm, sheet } = props;
  const variants = sheet.offerings.find((o) => o.offeringId === form.offeringId)?.variants ?? [];
  return (
    <>
      <SelectField
        id="session-offering"
        label={t("bookings.eventSessions.offering")}
        value={form.offeringId}
        options={sheet.offerings.map((o) => ({ value: o.offeringId, label: o.name }))}
        error={errorOf("offeringId")}
        hasBlank
        onChange={(offeringId) => setForm((current) => ({ ...current, offeringId, variantId: "" }))}
      />
      <SelectField
        id="session-variant"
        label={t("bookings.eventSessions.variant")}
        value={form.variantId}
        options={variants.map((v) => ({ value: v.variantId, label: v.name }))}
        error={errorOf("variantId")}
        hasBlank
        onChange={(variantId) => setForm((current) => ({ ...current, variantId }))}
      />
      <SelectField
        id="session-location"
        label={t("bookings.form.location")}
        value={form.locationId}
        options={sheet.locations.map((l) => ({ value: l.locationId, label: l.name }))}
        error={errorOf("locationId")}
        hasBlank={false}
        onChange={(locationId) => setForm((current) => ({ ...current, locationId }))}
      />
    </>
  );
}

function DateTimeField(props: {
  id: string;
  label: string;
  value: string;
  isLocked: boolean;
  error: string | undefined;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <FormField label={props.label} htmlFor={props.id} required error={props.error}>
      <TextInput
        id={props.id}
        type="datetime-local"
        disabled={props.isLocked}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </FormField>
  );
}

function SessionTimingFields(props: {
  form: EventSessionFormState;
  setForm: SetForm;
  isTimeLocked: boolean;
  errors: FieldErrors;
}): ReactElement {
  const { t } = useTranslator();
  const errorOf = useErrorText(props.errors);
  const { form, setForm } = props;
  return (
    <>
      <DateTimeField
        id="session-starts-at"
        label={t("bookings.eventSessions.startsAt")}
        value={form.startsAtLocal}
        isLocked={props.isTimeLocked}
        error={errorOf("startsAt")}
        onChange={(startsAtLocal) => setForm((current) => ({ ...current, startsAtLocal }))}
      />
      <DateTimeField
        id="session-ends-at"
        label={t("bookings.eventSessions.endsAt")}
        value={form.endsAtLocal}
        isLocked={props.isTimeLocked}
        error={errorOf("endsAt")}
        onChange={(endsAtLocal) => setForm((current) => ({ ...current, endsAtLocal }))}
      />
      {props.isTimeLocked ? (
        <p className="text-small text-secondary">{t("bookings.eventSessions.timeLocked")}</p>
      ) : null}
      <FormField
        label={t("bookings.eventSessions.capacity")}
        htmlFor="session-capacity"
        required
        error={errorOf("capacity")}
      >
        <TextInput
          id="session-capacity"
          inputMode="numeric"
          value={form.capacity}
          onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))}
        />
      </FormField>
    </>
  );
}

/** Creates a session or edits one: capacity may grow but never below the seats sold, and the time locks with the first seat. */
export function EventSessionSheet(props: EventSessionSheetProps): ReactElement {
  const { t } = useTranslator();
  const [form, setForm] = useState<EventSessionFormState>(() =>
    props.existing === undefined
      ? emptyEventSessionForm(props.defaultLocationId)
      : eventSessionFormOf(props.existing, props.timeZone),
  );
  const state = useSheetSubmit({
    fieldNames: ["offeringId", "variantId", "locationId", "startsAt", "endsAt", "capacity"],
    onClose: props.onClose,
    send: () => sendSession({ props, form }),
  });
  const isEdit = props.existing !== undefined;
  const isTimeLocked = isEdit && (props.existing?.seatsSold ?? 0) > 0;
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent
        title={t(
          isEdit ? "bookings.eventSessions.editTitle" : "bookings.eventSessions.createTitle",
        )}
        closeLabel={t("bookings.form.close")}
      >
        <form
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void state.submit();
          }}
          noValidate
          className="flex flex-col gap-4"
        >
          {isEdit ? null : (
            <SessionSelectFields
              form={form}
              setForm={setForm}
              sheet={props}
              errors={state.errors}
            />
          )}
          <SessionTimingFields
            form={form}
            setForm={setForm}
            isTimeLocked={isTimeLocked}
            errors={state.errors}
          />
          <SheetFeedback
            state={state}
            conflict={t("bookings.form.conflict")}
            reload={t("bookings.form.reload")}
          />
          <Button type="submit" isLoading={state.isSaving}>
            {t("bookings.form.save")}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

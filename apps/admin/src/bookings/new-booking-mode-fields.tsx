"use client";

import type { ResourceResponse } from "@banijjik/contracts/booking";
import type { Money, RentalDetails } from "@banijjik/contracts/catalog";
import { formatMoney, FormField, TextInput } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useScreenText, type ScreenText } from "./screen-text";
import type { ReactElement } from "react";
import {
  isoToLocalInputValue,
  localInputValueToIso,
  formatLocalTimeRange,
} from "./booking-local-time";
import type { EventSessionView } from "./event-session-api";
import { seatsLeftOf, type NewBookingMode } from "./new-booking-mode";
import { rentalEndPreview } from "./rental-end-preview";

function QuotePrice(props: { total: Money | null; isLoading: boolean }): ReactElement | null {
  const { locale } = useTranslator();
  const t = useScreenText();
  if (props.isLoading) {
    return <p className="text-small text-secondary">{t("bookings.sheet.priceLoading")}</p>;
  }
  if (props.total === null) return null;
  return (
    <p className="text-body font-semibold text-primary" data-testid="new-booking-price">
      {t("bookings.sheet.price")}: {formatMoney(props.total, { locale })}
    </p>
  );
}

function UnitsField(props: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <FormField label={props.label} htmlFor={props.id} {...(props.hint ? { hint: props.hint } : {})}>
      <TextInput
        id={props.id}
        inputMode="numeric"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </FormField>
  );
}

export interface NewBookingRentalStepProps {
  rental: RentalDetails;
  timeZone: string;
  locale: string;
  startsAt: string;
  quantity: string;
  resourceId: string;
  resources: readonly ResourceResponse[];
  total: Money | null;
  quoteLoading: boolean;
  onStartChange: (startsAt: string) => void;
  onQuantityChange: (quantity: string) => void;
  onResourceChange: (resourceId: string) => void;
}

function rentalUnitsHint(rental: RentalDetails, t: ScreenText): string {
  const unit = t(`catalog.details.rateUnit.${rental.rateUnit}`);
  return rental.maxUnits === undefined
    ? t("bookings.sheet.unitsMin", { min: rental.minUnits, unit })
    : t("bookings.sheet.unitsRange", { min: rental.minUnits, max: rental.maxUnits, unit });
}

/** A rental is a start plus a number of rate units; the end and the price are shown, not typed. */
export function NewBookingRentalStep(props: NewBookingRentalStepProps): ReactElement {
  const t = useScreenText();
  const preview = rentalEndPreview({
    startsAt: props.startsAt,
    quantity: Number(props.quantity),
    rental: props.rental,
    timeZone: props.timeZone,
  });
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-small text-secondary">{t("bookings.sheet.rentalLegend")}</legend>
      <FormField label={t("bookings.sheet.rentalStart")} htmlFor="new-booking-rental-start">
        <TextInput
          id="new-booking-rental-start"
          type="datetime-local"
          value={props.startsAt === "" ? "" : isoToLocalInputValue(props.startsAt, props.timeZone)}
          onChange={(event) =>
            props.onStartChange(localInputValueToIso(event.target.value, props.timeZone))
          }
        />
      </FormField>
      <UnitsField
        id="new-booking-quantity"
        label={t("bookings.sheet.units")}
        hint={rentalUnitsHint(props.rental, t)}
        value={props.quantity}
        onChange={props.onQuantityChange}
      />
      {props.resources.length > 0 ? (
        <FormField label={t("bookings.sheet.rentalResource")} htmlFor="new-booking-rental-resource">
          <select
            id="new-booking-rental-resource"
            className="min-h-11 rounded-md border border-default bg-surface px-3 text-body"
            value={props.resourceId}
            onChange={(event) => props.onResourceChange(event.target.value)}
          >
            <option value="">{t("bookings.sheet.anyResource")}</option>
            {props.resources.map((resource) => (
              <option key={resource.resourceId} value={resource.resourceId}>
                {resource.name}
              </option>
            ))}
          </select>
        </FormField>
      ) : null}
      {preview === null ? null : (
        <p className="text-small text-secondary" data-testid="new-booking-rental-end">
          {t("bookings.sheet.rentalEnds")}:{" "}
          {new Intl.DateTimeFormat(props.locale, {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: props.timeZone,
          }).format(new Date(preview.endsAt))}
        </p>
      )}
      <QuotePrice total={props.total} isLoading={props.quoteLoading} />
    </fieldset>
  );
}

export interface NewBookingEventStepProps {
  sessions: readonly EventSessionView[];
  sessionsLoading: boolean;
  eventSessionId: string;
  quantity: string;
  timeZone: string;
  locale: string;
  total: Money | null;
  quoteLoading: boolean;
  onPickSession: (session: EventSessionView) => void;
  onQuantityChange: (quantity: string) => void;
}

/** An event booking picks a session and a number of seats; the seats left come from the session itself. */
export function NewBookingEventStep(props: NewBookingEventStepProps): ReactElement {
  const t = useScreenText();
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-small text-secondary">{t("bookings.sheet.sessionLegend")}</legend>
      {props.sessionsLoading ? (
        <p className="text-small text-secondary">{t("bookings.sheet.loadingSessions")}</p>
      ) : null}
      {!props.sessionsLoading && props.sessions.length === 0 ? (
        <p className="text-small text-secondary">{t("bookings.sheet.noSessions")}</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {props.sessions.map((session) => (
          <li key={session.eventSessionId}>
            <button
              type="button"
              data-testid="new-booking-session"
              disabled={seatsLeftOf(session) === 0}
              className={`min-h-11 w-full rounded-md border px-3 text-start text-body disabled:opacity-50 ${
                props.eventSessionId === session.eventSessionId
                  ? "border-accent bg-accent-subtle"
                  : "border-default bg-surface"
              }`}
              onClick={() => props.onPickSession(session)}
            >
              <span className="block">
                {new Intl.DateTimeFormat(props.locale, {
                  dateStyle: "medium",
                  timeZone: props.timeZone,
                }).format(new Date(session.startsAt))}{" "}
                {formatLocalTimeRange({
                  startsAt: session.startsAt,
                  endsAt: session.endsAt,
                  locale: props.locale,
                  timeZone: props.timeZone,
                })}
              </span>
              <span className="block text-small text-secondary">
                {t("bookings.sheet.seatsLeft", { left: seatsLeftOf(session) })}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <UnitsField
        id="new-booking-quantity"
        label={t("bookings.sheet.seats")}
        value={props.quantity}
        onChange={props.onQuantityChange}
      />
      <QuotePrice total={props.total} isLoading={props.quoteLoading} />
    </fieldset>
  );
}

export interface NewBookingModeSummaryProps {
  mode: NewBookingMode;
  rental: RentalDetails | undefined;
  quantity: string;
  startsAt: string;
  timeZone: string;
  total: Money | null;
}

/** The extra confirm rows: units and end for a rental, seats for an event, and the quoted price. */
export function NewBookingModeSummary(props: NewBookingModeSummaryProps): ReactElement | null {
  const { locale } = useTranslator();
  const t = useScreenText();
  if (props.mode === "SLOT") return null;
  const preview =
    props.rental === undefined
      ? null
      : rentalEndPreview({
          startsAt: props.startsAt,
          quantity: Number(props.quantity),
          rental: props.rental,
          timeZone: props.timeZone,
        });
  return (
    <>
      <div>
        <dt className="text-small text-secondary">
          {t(props.mode === "RENTAL" ? "bookings.sheet.units" : "bookings.sheet.seats")}
        </dt>
        <dd>{props.quantity}</dd>
      </div>
      {preview === null ? null : (
        <div>
          <dt className="text-small text-secondary">{t("bookings.sheet.rentalEnds")}</dt>
          <dd>
            {new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: props.timeZone,
            }).format(new Date(preview.endsAt))}
          </dd>
        </div>
      )}
      {props.total === null ? null : (
        <div>
          <dt className="text-small text-secondary">{t("bookings.sheet.price")}</dt>
          <dd>{formatMoney(props.total, { locale })}</dd>
        </div>
      )}
    </>
  );
}

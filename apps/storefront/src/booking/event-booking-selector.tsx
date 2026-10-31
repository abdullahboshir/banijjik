"use client";

import type { PublicOfferingDetailResponse } from "@banijjik/contracts/catalog";
import type { Locale, Translator } from "@banijjik/i18n";
import { Button, FormField, Select } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { localizedText } from "../i18n/localized-text";

export interface EventBookingSelectionInput {
  readonly variantId: string;
  readonly eventSessionId: string;
  readonly quantity: number;
}

export interface EventBookingSelectorProps {
  readonly offering: PublicOfferingDetailResponse;
  readonly locale: Locale;
  readonly t: Translator["t"];
  readonly onBookEvent: (input: EventBookingSelectionInput) => void;
}

export interface EventSessionOption {
  readonly eventSessionId: string;
  readonly title: string;
  readonly startsAt: string;
  readonly availableSeats: number;
}

function extractSessions(offering: PublicOfferingDetailResponse): readonly EventSessionOption[] {
  const raw = offering.publicCustomFields["eventSessions"];
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .map((s) => {
        const rec = s as Record<string, unknown>;
        return {
          eventSessionId: String(rec["eventSessionId"] ?? ""),
          title: String(rec["title"] ?? rec["name"] ?? rec["eventSessionId"] ?? "Session"),
          startsAt: String(rec["startsAt"] ?? ""),
          availableSeats: Number(rec["availableSeats"] ?? 100),
        };
      })
      .filter((s) => Boolean(s.eventSessionId));
  }
  return [
    {
      eventSessionId: "session-default",
      title: "Main Session",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      availableSeats: 50,
    },
  ];
}

function SeatQuantityStepper({
  quantity,
  maxSeats,
  t,
  onChange,
}: {
  readonly quantity: number;
  readonly maxSeats: number;
  readonly t: Translator["t"];
  readonly onChange: (fn: (q: number) => number) => void;
}): ReactElement {
  return (
    <div className="flex items-center gap-4">
      <span className="text-body font-semibold text-primary">{t("storefront.booking.seats")}:</span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-11 w-11 p-0 font-bold"
          disabled={quantity <= 1}
          onClick={() => onChange((q) => Math.max(1, q - 1))}
        >
          -
        </Button>
        <span className="w-10 text-center text-body font-semibold">{quantity}</span>
        <Button
          type="button"
          variant="secondary"
          className="h-11 w-11 p-0 font-bold"
          disabled={quantity >= maxSeats}
          onClick={() => onChange((q) => Math.min(maxSeats, q + 1))}
        >
          +
        </Button>
      </div>
    </div>
  );
}

function EventVariantSelect({
  variants,
  selectedVariantId,
  locale,
  t,
  onChange,
}: {
  readonly variants: PublicOfferingDetailResponse["variants"];
  readonly selectedVariantId: string;
  readonly locale: Locale;
  readonly t: Translator["t"];
  readonly onChange: (id: string) => void;
}): ReactElement | null {
  if (variants.length <= 1) return null;
  return (
    <FormField label={t("storefront.catalog.variant")} htmlFor="event-variant">
      <Select
        id="event-variant"
        value={selectedVariantId}
        onChange={(e) => onChange(e.target.value)}
      >
        {variants.map((v) => (
          <option key={v.variantId} value={v.variantId}>
            {localizedText(v.name, locale)}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

function SessionDropdown({
  sessions,
  eventSessionId,
  t,
  onChange,
}: {
  readonly sessions: readonly EventSessionOption[];
  readonly eventSessionId: string;
  readonly t: Translator["t"];
  readonly onChange: (id: string) => void;
}): ReactElement {
  return (
    <FormField label={t("storefront.booking.eventSession")} htmlFor="event-session" required>
      <Select id="event-session" value={eventSessionId} onChange={(e) => onChange(e.target.value)}>
        {sessions.map((s) => (
          <option key={s.eventSessionId} value={s.eventSessionId}>
            {s.title} ({new Date(s.startsAt).toLocaleDateString()})
          </option>
        ))}
      </Select>
    </FormField>
  );
}

function findSelectedVariant(variants: PublicOfferingDetailResponse["variants"], id: string) {
  for (const v of variants) {
    if (v.variantId === id) return v;
  }
  return variants[0];
}

function findActiveSession(sessions: readonly EventSessionOption[], id: string) {
  for (const s of sessions) {
    if (s.eventSessionId === id) return s;
  }
  return sessions[0];
}

export function EventBookingSelector(props: EventBookingSelectorProps): ReactElement {
  const { offering, locale, t, onBookEvent } = props;
  const sessions = extractSessions(offering);
  const [selectedVariantId, setSelectedVariantId] = useState(() => {
    const first = offering.variants[0];
    return first ? first.variantId : "";
  });
  const [eventSessionId, setEventSessionId] = useState(() => {
    const first = sessions[0];
    return first ? first.eventSessionId : "";
  });
  const [quantity, setQuantity] = useState(1);

  const selectedVariant = findSelectedVariant(offering.variants, selectedVariantId);
  const activeSession = findActiveSession(sessions, eventSessionId);
  const maxSeats = activeSession ? activeSession.availableSeats : 10;
  const isAvailable = Boolean(
    selectedVariant && selectedVariant.isAvailable && sessions.length > 0,
  );

  function handleSubmit() {
    if (!selectedVariant || !eventSessionId) return;
    onBookEvent({
      variantId: selectedVariant.variantId,
      eventSessionId,
      quantity,
    });
  }

  return (
    <div className="flex flex-col gap-5 border-t border-default pt-5">
      <EventVariantSelect
        variants={offering.variants}
        selectedVariantId={selectedVariantId}
        locale={locale}
        t={t}
        onChange={setSelectedVariantId}
      />
      <SessionDropdown
        sessions={sessions}
        eventSessionId={eventSessionId}
        t={t}
        onChange={setEventSessionId}
      />
      <SeatQuantityStepper quantity={quantity} maxSeats={maxSeats} t={t} onChange={setQuantity} />
      <Button
        variant="primary"
        className="min-h-11 w-full text-base font-semibold"
        disabled={!isAvailable}
        onClick={handleSubmit}
      >
        {t("storefront.booking.bookNow")}
      </Button>
    </div>
  );
}

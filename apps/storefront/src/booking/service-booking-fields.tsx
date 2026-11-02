"use client";

import type { AvailabilitySlot } from "@banijjik/contracts/booking";
import type { PublicOfferingDetailResponse } from "@banijjik/contracts/catalog";
import type { Locale, Translator } from "@banijjik/i18n";
import { Button, FormField, Select, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import { localizedText } from "../i18n/localized-text";

export function todayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function WalkInOnlyBanner({ t }: { readonly t: Translator["t"] }): ReactElement {
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900"
    >
      <h3 className="font-semibold">{t("storefront.booking.walkInOnlyTitle")}</h3>
      <p className="text-small">{t("storefront.booking.walkInOnlyNotice")}</p>
    </div>
  );
}

function ServiceSlotPicker({
  date,
  slot,
  slots,
  loading,
  t,
  onDateChange,
  onSlotChange,
}: {
  readonly date: string;
  readonly slot: string;
  readonly slots: readonly AvailabilitySlot[];
  readonly loading: boolean;
  readonly t: Translator["t"];
  readonly onDateChange: (d: string) => void;
  readonly onSlotChange: (s: string) => void;
}): ReactElement {
  const empty = !loading && slots.length === 0;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FormField label={t("storefront.booking.selectDate")} htmlFor="booking-date" required>
        <TextInput
          id="booking-date"
          name="bookingDate"
          type="date"
          value={date}
          min={todayDateString()}
          onChange={(e) => onDateChange(e.target.value)}
          required
        />
      </FormField>
      <FormField label={t("storefront.booking.selectTimeSlot")} htmlFor="booking-time" required>
        <Select
          id="booking-time"
          value={slot}
          onChange={(e) => onSlotChange(e.target.value)}
          disabled={loading || empty}
        >
          {loading ? <option value="">{t("storefront.booking.loadingSlots")}</option> : null}
          {empty ? <option value="">{t("storefront.booking.noSlots")}</option> : null}
          {slots.map((row) => (
            <option key={row.startsAt} value={row.startsAt}>
              {row.startsAt}
            </option>
          ))}
        </Select>
      </FormField>
    </div>
  );
}

function ServiceResourcePicker({
  resource,
  resources,
  t,
  onResourceChange,
}: {
  readonly resource: string;
  readonly resources: readonly { readonly resourceId: string; readonly name: string }[];
  readonly t: Translator["t"];
  readonly onResourceChange: (r: string) => void;
}): ReactElement | null {
  if (resources.length === 0) return null;
  return (
    <FormField label={t("storefront.booking.selectResource")} htmlFor="booking-resource">
      <Select
        id="booking-resource"
        value={resource}
        onChange={(e) => onResourceChange(e.target.value)}
      >
        <option value="">{t("storefront.booking.anyResource")}</option>
        {resources.map((row) => (
          <option key={row.resourceId} value={row.resourceId}>
            {row.name}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

export function extractResources(
  offering: PublicOfferingDetailResponse,
): readonly { readonly resourceId: string; readonly name: string }[] {
  const raw = offering.publicCustomFields["resources"];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const rec = row as Record<string, unknown>;
      return {
        resourceId: String(rec["resourceId"] ?? ""),
        name: String(rec["name"] ?? rec["resourceId"] ?? ""),
      };
    })
    .filter((row) => Boolean(row.resourceId));
}

export function ServiceVariantSelect({
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
    <FormField label={t("storefront.catalog.variant")} htmlFor="service-variant">
      <Select
        id="service-variant"
        value={selectedVariantId}
        onChange={(e) => onChange(e.target.value)}
      >
        {variants.map((variant) => (
          <option key={variant.variantId} value={variant.variantId}>
            {localizedText(variant.name, locale)}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

export function ScheduledServiceFields({
  date,
  slot,
  slots,
  loading,
  resource,
  resources,
  t,
  onDateChange,
  onSlotChange,
  onResourceChange,
}: {
  readonly date: string;
  readonly slot: string;
  readonly slots: readonly AvailabilitySlot[];
  readonly loading: boolean;
  readonly resource: string;
  readonly resources: readonly { readonly resourceId: string; readonly name: string }[];
  readonly t: Translator["t"];
  readonly onDateChange: (d: string) => void;
  readonly onSlotChange: (s: string) => void;
  readonly onResourceChange: (r: string) => void;
}): ReactElement {
  return (
    <>
      <ServiceSlotPicker
        date={date}
        slot={slot}
        slots={slots}
        loading={loading}
        t={t}
        onDateChange={onDateChange}
        onSlotChange={onSlotChange}
      />
      <ServiceResourcePicker
        resource={resource}
        resources={resources}
        t={t}
        onResourceChange={onResourceChange}
      />
    </>
  );
}

export function ServiceScheduleOrWalkIn({
  walkIn,
  date,
  slot,
  slots,
  loading,
  resource,
  resources,
  t,
  onDateChange,
  onSlotChange,
  onResourceChange,
}: {
  readonly walkIn: boolean;
  readonly date: string;
  readonly slot: string;
  readonly slots: readonly AvailabilitySlot[];
  readonly loading: boolean;
  readonly resource: string;
  readonly resources: readonly { readonly resourceId: string; readonly name: string }[];
  readonly t: Translator["t"];
  readonly onDateChange: (d: string) => void;
  readonly onSlotChange: (s: string) => void;
  readonly onResourceChange: (r: string) => void;
}): ReactElement {
  if (walkIn) return <WalkInOnlyBanner t={t} />;
  return (
    <ScheduledServiceFields
      date={date}
      slot={slot}
      slots={slots}
      loading={loading}
      resource={resource}
      resources={resources}
      t={t}
      onDateChange={onDateChange}
      onSlotChange={onSlotChange}
      onResourceChange={onResourceChange}
    />
  );
}

export function BookServiceButton({
  walkIn,
  canBook,
  t,
  onClick,
}: {
  readonly walkIn: boolean;
  readonly canBook: boolean;
  readonly t: Translator["t"];
  readonly onClick: () => void;
}): ReactElement {
  return (
    <Button
      variant="primary"
      className="min-h-11 w-full text-base font-semibold"
      disabled={!canBook}
      onClick={onClick}
    >
      {walkIn ? t("storefront.booking.walkInOnlyTitle") : t("storefront.booking.bookNow")}
    </Button>
  );
}

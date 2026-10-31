"use client";

import type {
  PublicOfferingDetailResponse,
  PublicVariantResponse,
} from "@banijjik/contracts/catalog";
import type { Locale, Translator } from "@banijjik/i18n";
import { Button, FormField, Select, TextInput } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { localizedText } from "../i18n/localized-text";

export interface ServiceBookingSelectionInput {
  readonly variantId: string;
  readonly startsAt: string;
  readonly resourceIds: readonly string[];
}

export interface ServiceBookingSelectorProps {
  readonly organizationId: string;
  readonly offering: PublicOfferingDetailResponse;
  readonly locale: Locale;
  readonly t: Translator["t"];
  readonly onBookService: (input: ServiceBookingSelectionInput) => void;
}

function isWalkInOnly(
  offering: PublicOfferingDetailResponse,
  variant: PublicVariantResponse | undefined,
): boolean {
  if (offering.publicCustomFields["bookingMode"] === "WALK_IN_ONLY") return true;
  if (offering.publicCustomFields["walkInOnly"] === true) return true;
  if (variant?.attributes["bookingMode"] === "WALK_IN_ONLY") return true;
  return false;
}

function WalkInOnlyBanner({ t }: { readonly t: Translator["t"] }): ReactElement {
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

function todayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DEFAULT_TIME_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
] as const;

function ServiceSlotPicker({
  date,
  slot,
  t,
  onDateChange,
  onSlotChange,
}: {
  readonly date: string;
  readonly slot: string;
  readonly t: Translator["t"];
  readonly onDateChange: (d: string) => void;
  readonly onSlotChange: (s: string) => void;
}): ReactElement {
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
        <Select id="booking-time" value={slot} onChange={(e) => onSlotChange(e.target.value)}>
          {DEFAULT_TIME_SLOTS.map((s) => (
            <option key={s} value={s}>
              {s}
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
        {resources.map((r) => (
          <option key={r.resourceId} value={r.resourceId}>
            {r.name}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

function extractResources(offering: PublicOfferingDetailResponse) {
  const raw = offering.publicCustomFields["resources"];
  if (Array.isArray(raw)) {
    return raw
      .map((r) => {
        const rec = r as Record<string, unknown>;
        return {
          resourceId: String(rec["resourceId"] ?? ""),
          name: String(rec["name"] ?? rec["resourceId"] ?? ""),
        };
      })
      .filter((r) => Boolean(r.resourceId));
  }
  return [];
}

function ServiceVariantSelect({
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
        {variants.map((v) => (
          <option key={v.variantId} value={v.variantId}>
            {localizedText(v.name, locale)}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

export function ServiceBookingSelector(props: ServiceBookingSelectorProps): ReactElement {
  const { offering, locale, t, onBookService } = props;
  const [selectedVariantId, setSelectedVariantId] = useState(offering.variants[0]?.variantId ?? "");
  const [date, setDate] = useState(() => todayDateString());
  const [slot, setSlot] = useState("10:00");
  const [resource, setResource] = useState("");

  const selectedVariant =
    offering.variants.find((v) => v.variantId === selectedVariantId) ?? offering.variants[0];
  const walkIn = isWalkInOnly(offering, selectedVariant);
  const resources = extractResources(offering);

  function handleSubmit() {
    if (walkIn || !selectedVariant) return;
    const startsAt = new Date(`${date}T${slot}:00.000Z`).toISOString();
    onBookService({
      variantId: selectedVariant.variantId,
      startsAt,
      resourceIds: resource ? [resource] : [],
    });
  }

  return (
    <div className="flex flex-col gap-5 border-t border-default pt-5">
      <ServiceVariantSelect
        variants={offering.variants}
        selectedVariantId={selectedVariantId}
        locale={locale}
        t={t}
        onChange={setSelectedVariantId}
      />
      {walkIn ? (
        <WalkInOnlyBanner t={t} />
      ) : (
        <>
          <ServiceSlotPicker
            date={date}
            slot={slot}
            t={t}
            onDateChange={setDate}
            onSlotChange={setSlot}
          />
          <ServiceResourcePicker
            resource={resource}
            resources={resources}
            t={t}
            onResourceChange={setResource}
          />
        </>
      )}
      <Button
        variant="primary"
        className="min-h-11 w-full text-base font-semibold"
        disabled={walkIn || !selectedVariant?.isAvailable}
        onClick={handleSubmit}
      >
        {walkIn ? t("storefront.booking.walkInOnlyTitle") : t("storefront.booking.bookNow")}
      </Button>
    </div>
  );
}

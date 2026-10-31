"use client";

import type { PublicOfferingDetailResponse } from "@banijjik/contracts/catalog";
import type { Locale, Translator } from "@banijjik/i18n";
import { Button, FormField, Select, TextInput } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { localizedText } from "../i18n/localized-text";

export interface RentalBookingSelectionInput {
  readonly variantId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly resourceIds: readonly string[];
}

export interface RentalBookingSelectorProps {
  readonly offering: PublicOfferingDetailResponse;
  readonly locale: Locale;
  readonly t: Translator["t"];
  readonly onBookRental: (input: RentalBookingSelectionInput) => void;
}

function defaultDates() {
  const start = new Date();
  start.setHours(start.getHours() + 2, 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 4);
  return {
    startStr: start.toISOString().slice(0, 16),
    endStr: end.toISOString().slice(0, 16),
  };
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

function RentalDateInputs({
  startsAt,
  endsAt,
  t,
  onStartChange,
  onEndChange,
}: {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly t: Translator["t"];
  readonly onStartChange: (v: string) => void;
  readonly onEndChange: (v: string) => void;
}): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FormField label={t("storefront.booking.rentalStart")} htmlFor="rental-start" required>
        <TextInput
          id="rental-start"
          name="rentalStart"
          type="datetime-local"
          value={startsAt}
          onChange={(e) => onStartChange(e.target.value)}
          required
        />
      </FormField>
      <FormField label={t("storefront.booking.rentalEnd")} htmlFor="rental-end" required>
        <TextInput
          id="rental-end"
          name="rentalEnd"
          type="datetime-local"
          value={endsAt}
          onChange={(e) => onEndChange(e.target.value)}
          required
        />
      </FormField>
    </div>
  );
}

function RentalVariantSelect({
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
    <FormField label={t("storefront.catalog.variant")} htmlFor="rental-variant">
      <Select
        id="rental-variant"
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

function RentalResourceSelect({
  resource,
  resources,
  t,
  onChange,
}: {
  readonly resource: string;
  readonly resources: readonly { readonly resourceId: string; readonly name: string }[];
  readonly t: Translator["t"];
  readonly onChange: (r: string) => void;
}): ReactElement | null {
  if (resources.length === 0) return null;
  return (
    <FormField label={t("storefront.booking.selectResource")} htmlFor="rental-resource">
      <Select id="rental-resource" value={resource} onChange={(e) => onChange(e.target.value)}>
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

export function RentalBookingSelector(props: RentalBookingSelectorProps): ReactElement {
  const { offering, locale, t, onBookRental } = props;
  const defaults = defaultDates();
  const [selectedVariantId, setSelectedVariantId] = useState(offering.variants[0]?.variantId ?? "");
  const [startsAt, setStartsAt] = useState(defaults.startStr);
  const [endsAt, setEndsAt] = useState(defaults.endStr);
  const [resource, setResource] = useState("");

  const selectedVariant =
    offering.variants.find((v) => v.variantId === selectedVariantId) ?? offering.variants[0];
  const resources = extractResources(offering);

  const startMs = Date.parse(startsAt);
  const endMs = Date.parse(endsAt);
  const isValidRange = !Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs;

  function handleSubmit() {
    if (!selectedVariant || !isValidRange) return;
    onBookRental({
      variantId: selectedVariant.variantId,
      startsAt: new Date(startMs).toISOString(),
      endsAt: new Date(endMs).toISOString(),
      resourceIds: resource ? [resource] : [],
    });
  }

  return (
    <div className="flex flex-col gap-5 border-t border-default pt-5">
      <RentalVariantSelect
        variants={offering.variants}
        selectedVariantId={selectedVariantId}
        locale={locale}
        t={t}
        onChange={setSelectedVariantId}
      />
      <RentalDateInputs
        startsAt={startsAt}
        endsAt={endsAt}
        t={t}
        onStartChange={setStartsAt}
        onEndChange={setEndsAt}
      />
      {!isValidRange ? (
        <p role="alert" className="text-small text-danger">
          {t("storefront.booking.invalidRentalRange")}
        </p>
      ) : null}
      <RentalResourceSelect
        resource={resource}
        resources={resources}
        t={t}
        onChange={setResource}
      />
      <Button
        variant="primary"
        className="min-h-11 w-full text-base font-semibold"
        disabled={!isValidRange || !selectedVariant?.isAvailable}
        onClick={handleSubmit}
      >
        {t("storefront.booking.bookNow")}
      </Button>
    </div>
  );
}

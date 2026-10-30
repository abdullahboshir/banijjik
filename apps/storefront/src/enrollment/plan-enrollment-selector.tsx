"use client";

import type { PublicOfferingDetailResponse } from "@banijjik/contracts/catalog";
import type { Locale, Translator } from "@banijjik/i18n";
import { Button, FormField, Select, TextInput } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { localizedText } from "../i18n/localized-text";

export interface PlanEnrollmentSelectionInput {
  readonly variantId: string;
  readonly startsOn: string;
  readonly resourceIds: readonly string[];
  readonly customFields: Readonly<Record<string, unknown>>;
}

export interface PlanEnrollmentSelectorProps {
  readonly offering: PublicOfferingDetailResponse;
  readonly locale: Locale;
  readonly t: Translator["t"];
  readonly onEnrollPlan: (input: PlanEnrollmentSelectionInput) => void;
}

function formatPrice(amount: number, currency: string): string {
  return `${currency} ${(amount / 100).toFixed(2)}`;
}

function todayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

function readFeeNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const parsed = Number(val);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function computePlanFees(
  offering: PublicOfferingDetailResponse,
  variant: PublicOfferingDetailResponse["variants"][number] | undefined,
) {
  const admRaw = offering.publicCustomFields["admissionFee"] ?? variant?.attributes["admissionFee"];
  const depRaw =
    offering.publicCustomFields["securityDeposit"] ?? variant?.attributes["securityDeposit"];
  const admissionFee = readFeeNumber(admRaw);
  const securityDeposit = readFeeNumber(depRaw);
  const firstRecurringFee = variant ? variant.price.amount : 0;
  const currency = variant ? variant.price.currency : "BDT";
  return { admissionFee, securityDeposit, firstRecurringFee, currency };
}

function UpfrontObligationBreakdown({
  fees,
  t,
}: {
  readonly fees: ReturnType<typeof computePlanFees>;
  readonly t: Translator["t"];
}): ReactElement {
  const { admissionFee, firstRecurringFee, securityDeposit, currency } = fees;
  const total = admissionFee + firstRecurringFee + securityDeposit;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-default bg-subtle/50 p-4">
      <h3 className="text-body font-semibold text-primary">
        {t("storefront.enrollment.upfrontBreakdown")}
      </h3>
      <div className="flex flex-col gap-1 text-small">
        {admissionFee > 0 ? (
          <div className="flex justify-between text-secondary">
            <span>{t("storefront.enrollment.admissionFee")}</span>
            <span>{formatPrice(admissionFee, currency)}</span>
          </div>
        ) : null}
        <div className="flex justify-between text-secondary">
          <span>{t("storefront.enrollment.firstRecurringFee")}</span>
          <span>{formatPrice(firstRecurringFee, currency)}</span>
        </div>
        {securityDeposit > 0 ? (
          <div className="flex justify-between text-secondary">
            <span>{t("storefront.enrollment.securityDeposit")}</span>
            <span>{formatPrice(securityDeposit, currency)}</span>
          </div>
        ) : null}
        <div className="mt-1 flex justify-between border-t border-default pt-2 font-bold text-primary">
          <span>{t("storefront.enrollment.totalUpfront")}</span>
          <span>{formatPrice(total, currency)}</span>
        </div>
      </div>
    </div>
  );
}

function PlanVariantSelect({
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
    <FormField label={t("storefront.catalog.variant")} htmlFor="plan-variant">
      <Select
        id="plan-variant"
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

function PlanResourceSelect({
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
    <FormField label={t("storefront.enrollment.resource")} htmlFor="plan-resource">
      <Select id="plan-resource" value={resource} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t("storefront.enrollment.selectResource")}</option>
        {resources.map((r) => (
          <option key={r.resourceId} value={r.resourceId}>
            {r.name}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

function PlanInputs({
  startsOn,
  notes,
  resource,
  resources,
  t,
  onStartsOnChange,
  onNotesChange,
  onResourceChange,
}: {
  readonly startsOn: string;
  readonly notes: string;
  readonly resource: string;
  readonly resources: readonly { readonly resourceId: string; readonly name: string }[];
  readonly t: Translator["t"];
  readonly onStartsOnChange: (d: string) => void;
  readonly onNotesChange: (n: string) => void;
  readonly onResourceChange: (r: string) => void;
}): ReactElement {
  return (
    <>
      <FormField label={t("storefront.enrollment.startsOn")} htmlFor="plan-start" required>
        <TextInput
          id="plan-start"
          name="startsOn"
          type="date"
          value={startsOn}
          min={todayDateString()}
          onChange={(e) => onStartsOnChange(e.target.value)}
          required
        />
      </FormField>
      <PlanResourceSelect
        resource={resource}
        resources={resources}
        t={t}
        onChange={onResourceChange}
      />
      <FormField label={t("storefront.enrollment.customNotes")} htmlFor="plan-notes">
        <TextInput
          id="plan-notes"
          name="notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
        />
      </FormField>
    </>
  );
}

export function PlanEnrollmentSelector(props: PlanEnrollmentSelectorProps): ReactElement {
  const { offering, locale, t, onEnrollPlan } = props;
  const resources = extractResources(offering);
  const [selectedVariantId, setSelectedVariantId] = useState(offering.variants[0]?.variantId ?? "");
  const [startsOn, setStartsOn] = useState(() => todayDateString());
  const [resource, setResource] = useState("");
  const [notes, setNotes] = useState("");

  const selectedVariant =
    offering.variants.find((v) => v.variantId === selectedVariantId) ?? offering.variants[0];
  const fees = computePlanFees(offering, selectedVariant);

  function handleSubmit() {
    if (!selectedVariant || !startsOn) return;
    onEnrollPlan({
      variantId: selectedVariant.variantId,
      startsOn,
      resourceIds: resource ? [resource] : [],
      customFields: notes ? { notes } : {},
    });
  }

  const isEnrollable = Boolean(selectedVariant && selectedVariant.isAvailable && startsOn);

  return (
    <div className="flex flex-col gap-5 border-t border-default pt-5">
      <PlanVariantSelect
        variants={offering.variants}
        selectedVariantId={selectedVariantId}
        locale={locale}
        t={t}
        onChange={setSelectedVariantId}
      />
      <PlanInputs
        startsOn={startsOn}
        notes={notes}
        resource={resource}
        resources={resources}
        t={t}
        onStartsOnChange={setStartsOn}
        onNotesChange={setNotes}
        onResourceChange={setResource}
      />
      <UpfrontObligationBreakdown fees={fees} t={t} />
      <Button
        variant="primary"
        className="min-h-11 w-full text-base font-semibold"
        disabled={!isEnrollable}
        onClick={handleSubmit}
      >
        {t("storefront.enrollment.enrollNow")}
      </Button>
    </div>
  );
}

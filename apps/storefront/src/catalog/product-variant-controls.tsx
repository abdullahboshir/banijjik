"use client";

import type { PublicOfferingDetailResponse } from "@banijjik/contracts/catalog";
import type { Locale, Translator } from "@banijjik/i18n";
import { Button, FormField, Select } from "@banijjik/ui";
import type { ReactElement } from "react";
import { localizedText } from "../i18n/localized-text";
import { ModifierGroupPicker } from "./modifier-group-picker";

function formatPrice(amount: number, currency: string): string {
  return `${currency} ${(amount / 100).toFixed(2)}`;
}

function QuantityStepper({
  quantity,
  t,
  onChange,
}: {
  readonly quantity: number;
  readonly t: Translator["t"];
  readonly onChange: (fn: (q: number) => number) => void;
}): ReactElement {
  return (
    <div className="flex items-center gap-4">
      <span className="text-body font-semibold text-primary">
        {t("storefront.catalog.quantity")}:
      </span>
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
          onClick={() => onChange((q) => q + 1)}
        >
          +
        </Button>
      </div>
    </div>
  );
}

function VariantSelectDropdown({
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
    <FormField label={t("storefront.catalog.variant")} htmlFor="variant-select">
      <Select
        id="variant-select"
        value={selectedVariantId}
        onChange={(e) => onChange(e.target.value)}
      >
        {variants.map((v) => (
          <option key={v.variantId} value={v.variantId}>
            {localizedText(v.name, locale)} - {formatPrice(v.price.amount, v.price.currency)}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

function ModifierGroupsList({
  groups,
  locale,
  t,
  selectedModifiers,
  onModifiersChange,
}: {
  readonly groups: PublicOfferingDetailResponse["modifierGroups"];
  readonly locale: Locale;
  readonly t: Translator["t"];
  readonly selectedModifiers: Record<string, string[]>;
  readonly onModifiersChange: (mods: Record<string, string[]>) => void;
}): ReactElement {
  return (
    <>
      {groups.map((group) => (
        <ModifierGroupPicker
          key={group.modifierGroupId}
          group={group}
          locale={locale}
          t={t}
          selectedIds={selectedModifiers[group.modifierGroupId] ?? []}
          onToggle={(optId) => {
            const current = selectedModifiers[group.modifierGroupId] ?? [];
            const next = current.includes(optId)
              ? current.filter((id) => id !== optId)
              : [...current, optId];
            onModifiersChange({ ...selectedModifiers, [group.modifierGroupId]: next });
          }}
        />
      ))}
    </>
  );
}

export function ProductVariantControls({
  offering,
  locale,
  t,
  selectedVariantId,
  selectedModifiers,
  quantity,
  onVariantChange,
  onModifiersChange,
  onQuantityChange,
  onAddToCart,
}: {
  readonly offering: PublicOfferingDetailResponse;
  readonly locale: Locale;
  readonly t: Translator["t"];
  readonly selectedVariantId: string;
  readonly selectedModifiers: Record<string, string[]>;
  readonly quantity: number;
  readonly onVariantChange: (id: string) => void;
  readonly onModifiersChange: (mods: Record<string, string[]>) => void;
  readonly onQuantityChange: (fn: (q: number) => number) => void;
  readonly onAddToCart: () => void;
}): ReactElement {
  const currentVariant =
    offering.variants.find((v) => v.variantId === selectedVariantId) ?? offering.variants[0];
  const isAvailable = currentVariant?.isAvailable ?? false;

  return (
    <div className="flex flex-col gap-5 border-t border-default pt-5">
      <VariantSelectDropdown
        variants={offering.variants}
        selectedVariantId={selectedVariantId}
        locale={locale}
        t={t}
        onChange={onVariantChange}
      />

      <ModifierGroupsList
        groups={offering.modifierGroups}
        locale={locale}
        t={t}
        selectedModifiers={selectedModifiers}
        onModifiersChange={onModifiersChange}
      />

      <QuantityStepper quantity={quantity} t={t} onChange={onQuantityChange} />

      <Button
        variant="primary"
        className="min-h-11 w-full text-base"
        disabled={!isAvailable}
        onClick={onAddToCart}
      >
        {isAvailable ? t("storefront.catalog.addToCart") : t("storefront.catalog.outOfStock")}
      </Button>
    </div>
  );
}

"use client";

import type { PublicModifierGroupResponse } from "@banijjik/contracts/catalog";
import type { Locale, Translator } from "@banijjik/i18n";
import type { ReactElement } from "react";
import { localizedText } from "../i18n/localized-text";

function formatPrice(amount: number, currency: string): string {
  return `${currency} ${(amount / 100).toFixed(2)}`;
}

export function ModifierGroupPicker({
  group,
  locale,
  t,
  selectedIds,
  onToggle,
}: {
  readonly group: PublicModifierGroupResponse;
  readonly locale: Locale;
  readonly t: Translator["t"];
  readonly selectedIds: readonly string[];
  readonly onToggle: (optionId: string) => void;
}): ReactElement {
  const reqText = group.isRequired
    ? t("storefront.catalog.requiredModifier")
    : t("storefront.catalog.optionalModifier");

  return (
    <div className="flex flex-col gap-2 rounded-md border border-default p-3 bg-surface">
      <div className="flex items-center justify-between">
        <span className="text-body font-semibold text-primary">
          {localizedText(group.name, locale)}
        </span>
        <span className="text-xs text-secondary">{reqText}</span>
      </div>
      <div className="flex flex-col gap-2">
        {group.options.map((opt) => (
          <label
            key={opt.modifierOptionId}
            className="flex min-h-11 cursor-pointer items-center justify-between rounded px-2 hover:bg-subtle"
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedIds.includes(opt.modifierOptionId)}
                onChange={() => onToggle(opt.modifierOptionId)}
                className="h-4 w-4 text-brand"
              />
              <span className="text-body text-primary">{localizedText(opt.name, locale)}</span>
            </div>
            {opt.priceDelta.amount !== 0 ? (
              <span className="text-small text-secondary">
                +{formatPrice(opt.priceDelta.amount, opt.priceDelta.currency)}
              </span>
            ) : null}
          </label>
        ))}
      </div>
    </div>
  );
}

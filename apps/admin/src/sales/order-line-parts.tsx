import type { CurrencyCode } from "@banijjik/contracts";
import type { ModifierGroupResponse, VariantResponse } from "@banijjik/contracts/catalog";
import { Checkbox, Select, formatMoney, type DisplayLocale } from "@banijjik/ui";
import type { ReactElement } from "react";
import { looseCountingUnit } from "../catalog/quantity-rule";
import type { OrderLineLabels } from "./order-labels";

export function replace(template: string, values: Readonly<Record<string, string>>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template,
  );
}

export function unitLabelOf(labels: Readonly<Record<string, string>>, unitKey: string): string {
  return labels[unitKey] ?? unitKey;
}

export function quantityHint(
  variant: VariantResponse,
  quantityText: string,
  inputs: {
    readonly labels: OrderLineLabels;
    readonly unitLabels: Readonly<Record<string, string>>;
  },
): string | undefined {
  const { labels, unitLabels } = inputs;
  const rule = variant.quantityRule;
  const words = unitLabelOf(
    unitLabels,
    rule === null ? variant.unitKey : looseCountingUnit(variant.unitKey),
  );
  if (rule === null) return `${quantityText} ${unitLabelOf(unitLabels, variant.unitKey)}`;
  return replace(labels.quantityRule, {
    min: String(rule.min),
    step: String(rule.step),
    unit: words,
  });
}

export function selectedInGroup(
  group: ModifierGroupResponse,
  selectedOptionIds: readonly string[],
): string[] {
  const ids = group.options.map((option) => option.modifierOptionId);
  return selectedOptionIds.filter((id) => ids.includes(id));
}

export function toggleOption(
  selected: readonly string[],
  optionId: string,
  group: ModifierGroupResponse,
): string[] {
  const inside = selectedInGroup(group, selected);
  if (group.selection === "SINGLE") {
    return [...selected.filter((id) => !inside.includes(id)), optionId];
  }
  if (inside.includes(optionId)) return selected.filter((id) => id !== optionId);
  if (inside.length >= group.maxSelect) return [...selected];
  return [...selected, optionId];
}

export function ModifierGroupField(props: {
  readonly group: ModifierGroupResponse;
  readonly selected: readonly string[];
  readonly labels: OrderLineLabels;
  readonly disabled: boolean;
  readonly onToggle: (optionId: string) => void;
}): ReactElement {
  const { group, selected, labels, disabled } = props;
  const singleValue = selectedInGroup(group, selected)[0] ?? "";
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-small font-semibold text-primary">
        {group.name}
        {group.isRequired ? (
          <span aria-hidden="true" className="ms-1 text-danger">
            *
          </span>
        ) : null}
      </legend>
      {group.selection === "SINGLE" ? (
        <Select
          aria-label={group.name}
          value={singleValue}
          disabled={disabled}
          onChange={(event) => props.onToggle(event.target.value)}
        >
          <option value="">{labels.none}</option>
          {group.options.map((option) => (
            <option key={option.modifierOptionId} value={option.modifierOptionId}>
              {option.name}
            </option>
          ))}
        </Select>
      ) : (
        group.options.map((option) => (
          <Checkbox
            key={option.modifierOptionId}
            label={option.name}
            checked={selected.includes(option.modifierOptionId)}
            disabled={disabled}
            onChange={() => props.onToggle(option.modifierOptionId)}
          />
        ))
      )}
    </fieldset>
  );
}

export function LineTotals(props: {
  readonly variant: VariantResponse;
  readonly quantityText: string;
  readonly selected: readonly string[];
  readonly groups: readonly ModifierGroupResponse[];
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly labels: OrderLineLabels;
}): ReactElement | null {
  const { variant } = props;
  const parsed = Number(props.quantityText.trim());
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
  const deltas = props.groups.flatMap((group) =>
    group.options
      .filter((option) => props.selected.includes(option.modifierOptionId))
      .map((option) => option.priceDelta.amount),
  );
  const unit = variant.price.amount + deltas.reduce((total, delta) => total + delta, 0);
  return (
    <p className="text-small text-secondary">
      {props.labels.unitPrice}:{" "}
      <span className="font-money">
        {formatMoney({ amount: unit, currency: props.currency }, { locale: props.locale })}
      </span>
      {" · "}
      <span className="font-money">
        {formatMoney({ amount: unit * parsed, currency: props.currency }, { locale: props.locale })}
      </span>
    </p>
  );
}

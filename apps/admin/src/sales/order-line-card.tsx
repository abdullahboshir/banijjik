"use client";

import type { ModifierGroupResponse, VariantResponse } from "@banijjik/contracts/catalog";
import { Button, FormField, Select, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import { LazyOrderPerformerSelect } from "./lazy-order-performer-select";
import { LazyProductPicker } from "./lazy-product-picker";
import type { OrderLineLabels } from "./order-labels";
import { LineTotals, ModifierGroupField, quantityHint, toggleOption } from "./order-line-parts";
import type { OrderLinesEditorProps } from "./order-lines-editor";
import {
  modifierGroupsOf,
  parseLineDraft,
  requiredGroupMissing,
  variantOf,
  type DiscountTypeChoice,
  type LineParse,
  type OrderLineDraft,
} from "./order-lines";

interface LineCardProps {
  readonly index: number;
  readonly line: OrderLineDraft;
  readonly editor: OrderLinesEditorProps;
  readonly onChange: (changes: Partial<OrderLineDraft>) => void;
  readonly onRemove: () => void;
}

interface FieldProps {
  readonly index: number;
  readonly line: OrderLineDraft;
  readonly labels: OrderLineLabels;
  readonly disabled: boolean;
  readonly onChange: (changes: Partial<OrderLineDraft>) => void;
}

function VariantField(
  props: FieldProps & { readonly variant: VariantResponse },
): ReactElement | null {
  const variants = props.line.offering?.variants ?? [];
  if (variants.length <= 1) return null;
  return (
    <FormField label={props.labels.variant} htmlFor={`order-variant-${props.index}`}>
      <Select
        id={`order-variant-${props.index}`}
        value={props.variant.variantId}
        disabled={props.disabled}
        onChange={(event) => props.onChange({ variantId: event.target.value })}
      >
        {variants.map((option) => (
          <option key={option.variantId} value={option.variantId}>
            {option.name}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

function QuantityField(
  props: FieldProps & {
    readonly variant: VariantResponse;
    readonly parsed: LineParse;
    readonly unitLabels: Readonly<Record<string, string>>;
  },
): ReactElement {
  const { labels, parsed } = props;
  const hasError = parsed.kind === "invalid" && parsed.field === "quantity";
  return (
    <FormField
      label={labels.quantity}
      htmlFor={`order-qty-${props.index}`}
      {...(hasError ? { error: labels.quantityInvalid } : {})}
      hint={quantityHint(props.variant, props.line.quantity, {
        labels,
        unitLabels: props.unitLabels,
      })}
    >
      <TextInput
        id={`order-qty-${props.index}`}
        inputMode="numeric"
        autoComplete="off"
        value={props.line.quantity}
        disabled={props.disabled}
        onChange={(event) => props.onChange({ quantity: event.target.value })}
      />
    </FormField>
  );
}

function ModifiersSection(
  props: FieldProps & { readonly groups: readonly ModifierGroupResponse[] },
): ReactElement | null {
  const { line, labels } = props;
  if (props.groups.length === 0) return null;
  const missingRequired = requiredGroupMissing(props.groups, line.modifierOptionIds);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-small font-semibold text-primary">{labels.modifiers}</p>
      {props.groups.map((group) => (
        <ModifierGroupField
          key={group.modifierGroupId}
          group={group}
          selected={line.modifierOptionIds}
          labels={labels}
          disabled={props.disabled}
          onToggle={(optionId) =>
            props.onChange({
              modifierOptionIds: toggleOption(line.modifierOptionIds, optionId, group),
            })
          }
        />
      ))}
      {missingRequired ? <p className="text-small text-danger">{labels.required}</p> : null}
    </div>
  );
}

function DiscountFields(props: FieldProps & { readonly parsed: LineParse }): ReactElement {
  const { line, labels, parsed } = props;
  const hasError = parsed.kind === "invalid" && parsed.field === "discount";
  function changeType(type: DiscountTypeChoice): void {
    props.onChange({ discountType: type, discountText: type === "NONE" ? "" : line.discountText });
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <FormField label={labels.discount} htmlFor={`order-discount-${props.index}`}>
        <Select
          id={`order-discount-${props.index}`}
          value={line.discountType}
          disabled={props.disabled}
          onChange={(event) => changeType(event.target.value as DiscountTypeChoice)}
        >
          <option value="NONE">{labels.discountNone}</option>
          <option value="PERCENT">{labels.discountPercent}</option>
          <option value="AMOUNT">{labels.discountAmount}</option>
        </Select>
      </FormField>
      {line.discountType === "NONE" ? null : (
        <FormField
          label={labels.discountValue}
          htmlFor={`order-discount-value-${props.index}`}
          {...(hasError ? { error: labels.discountInvalid } : {})}
        >
          <TextInput
            id={`order-discount-value-${props.index}`}
            inputMode="decimal"
            value={line.discountText}
            disabled={props.disabled}
            onChange={(event) => props.onChange({ discountText: event.target.value })}
          />
        </FormField>
      )}
    </div>
  );
}

function PickedLineFields(
  props: LineCardProps & { readonly variant: VariantResponse },
): ReactElement {
  const { line, editor } = props;
  const fieldProps: FieldProps = {
    index: props.index,
    line,
    labels: editor.labels,
    disabled: editor.disabled,
    onChange: props.onChange,
  };
  const parsed = parseLineDraft(line);
  const groups =
    line.offering === undefined ? [] : modifierGroupsOf(line.offering, editor.modifierGroups);
  return (
    <>
      <VariantField {...fieldProps} variant={props.variant} />
      <QuantityField
        {...fieldProps}
        variant={props.variant}
        parsed={parsed}
        unitLabels={editor.unitLabels}
      />
      <ModifiersSection {...fieldProps} groups={groups} />
      <DiscountFields {...fieldProps} parsed={parsed} />
      <LineTotals
        variant={props.variant}
        quantityText={line.quantity}
        selected={line.modifierOptionIds}
        groups={groups}
        currency={editor.currency}
        locale={editor.locale}
        labels={editor.labels}
      />
    </>
  );
}

export function OrderLineCard(props: LineCardProps): ReactElement {
  const { line, editor } = props;
  const variant = variantOf(line);
  return (
    <div className="flex flex-col gap-3 rounded-md border border-default p-3">
      <LazyProductPicker
        organizationId={editor.organizationId}
        id={`order-product-${props.index}`}
        selected={line.offering}
        labels={editor.labels}
        locale={editor.locale}
        disabled={editor.disabled}
        includeServices={editor.includeServices === true}
        onChange={(offering) =>
          props.onChange({
            offering,
            variantId: offering?.variants[0]?.variantId ?? "",
            modifierOptionIds: [],
          })
        }
      />
      {editor.performers === undefined ? null : (
        <LazyOrderPerformerSelect
          organizationId={editor.organizationId}
          locationId={editor.performers.locationId}
          id={`order-performer-${props.index}`}
          value={line.performedByMemberId}
          disabled={editor.disabled}
          labels={editor.performers.labels}
          onChange={(memberId) => props.onChange({ performedByMemberId: memberId })}
        />
      )}
      {variant === undefined ? null : <PickedLineFields {...props} variant={variant} />}
      {editor.lines.length > 1 ? (
        <Button variant="secondary" disabled={editor.disabled} onClick={props.onRemove}>
          {editor.labels.remove}
        </Button>
      ) : null}
    </div>
  );
}

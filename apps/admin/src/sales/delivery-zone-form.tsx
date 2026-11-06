"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import {
  DELIVERY_ZONE_STATUS,
  type DeliveryZone,
  type DeliveryZoneStatus,
} from "@banijjik/contracts/sales/delivery";
import { Button, FormField, Select, TextInput } from "@banijjik/ui";
import { moneyFromInput, moneyToInputText } from "@banijjik/web-client";
import { useState, type FormEvent, type ReactElement } from "react";
import type { DeliveryZoneLabels } from "./delivery-zone-labels";
import { createDeliveryZone, updateDeliveryZone } from "./order-api";

export interface DeliveryZoneFormProps {
  readonly organizationId: string;
  readonly zone?: DeliveryZone | undefined;
  readonly currency: CurrencyCode;
  readonly labels: DeliveryZoneLabels;
  readonly onSaved: (zone: DeliveryZone) => void;
  readonly onCancel: () => void;
}

interface FormValues {
  readonly zoneKey: string;
  readonly nameEn: string;
  readonly nameBn: string;
  readonly feeText: string;
  readonly areaCodesText: string;
}

interface ValidatedZone {
  readonly trimmedKey: string;
  readonly nameEn: string;
  readonly nameBn: string;
  readonly parsedCodes: readonly string[];
  readonly feeMinor: number;
}

function parseAreaCodes(input: string): readonly string[] {
  return input
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

function hasDuplicateAreaCodes(codes: readonly string[]): boolean {
  return new Set(codes).size !== codes.length;
}

function validateNames(values: FormValues, labels: DeliveryZoneLabels): string | null {
  if (!values.zoneKey.trim()) return labels.zoneKeyRequired;
  if (!values.nameEn.trim()) return labels.nameEnRequired;
  if (!values.nameBn.trim()) return labels.nameBnRequired;
  return null;
}

function validateZoneValues(
  values: FormValues,
  currency: CurrencyCode,
  labels: DeliveryZoneLabels,
): { readonly error?: string; readonly data?: ValidatedZone } {
  const nameError = validateNames(values, labels);
  if (nameError) return { error: nameError };

  const parsedCodes = parseAreaCodes(values.areaCodesText);
  if (parsedCodes.length === 0) return { error: labels.areaCodesRequired };
  if (hasDuplicateAreaCodes(parsedCodes)) return { error: labels.duplicateAreaCode };

  const feeMoney = moneyFromInput(values.feeText, currency);
  if (!feeMoney || feeMoney.amount < 0) return { error: labels.feeInvalid };

  return {
    data: {
      trimmedKey: values.zoneKey.trim(),
      nameEn: values.nameEn.trim(),
      nameBn: values.nameBn.trim(),
      parsedCodes,
      feeMinor: feeMoney.amount,
    },
  };
}

interface PersistInput {
  readonly organizationId: string;
  readonly zone: DeliveryZone | undefined;
  readonly data: ValidatedZone;
  readonly status: DeliveryZoneStatus;
}

async function persistDeliveryZone(input: PersistInput): Promise<DeliveryZone> {
  const { organizationId, zone, data, status } = input;
  if (zone) {
    return updateDeliveryZone(organizationId, zone.deliveryZoneId, {
      version: zone.version,
      name: { en: data.nameEn, bn: data.nameBn },
      areaCodes: data.parsedCodes,
      feeMinor: data.feeMinor,
      status,
    });
  }
  return createDeliveryZone(organizationId, {
    zoneKey: data.trimmedKey,
    name: { en: data.nameEn, bn: data.nameBn },
    areaCodes: data.parsedCodes,
    feeMinor: data.feeMinor,
    status,
  });
}

function initialFormValues(zone: DeliveryZone | undefined): FormValues {
  if (!zone) {
    return {
      zoneKey: "",
      nameEn: "",
      nameBn: "",
      feeText: "0",
      areaCodesText: "",
    };
  }
  return {
    zoneKey: zone.zoneKey,
    nameEn: zone.name.en,
    nameBn: zone.name.bn,
    feeText: moneyToInputText(zone.fee),
    areaCodesText: zone.areaCodes.join(", "),
  };
}

interface NamesGroupProps {
  readonly labels: DeliveryZoneLabels;
  readonly isEditing: boolean;
  readonly isSaving: boolean;
  readonly values: FormValues;
  readonly onValuesChange: (updater: (prev: FormValues) => FormValues) => void;
}

function ZoneNamesGroup(props: NamesGroupProps): ReactElement {
  const { labels, isEditing, isSaving, values, onValuesChange } = props;
  return (
    <>
      <FormField label={labels.zoneKey} htmlFor="zone-key" required>
        <TextInput
          id="zone-key"
          value={values.zoneKey}
          disabled={isEditing || isSaving}
          onChange={(e) => onValuesChange((v) => ({ ...v, zoneKey: e.target.value }))}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={labels.nameEn} htmlFor="zone-name-en" required>
          <TextInput
            id="zone-name-en"
            value={values.nameEn}
            disabled={isSaving}
            onChange={(e) => onValuesChange((v) => ({ ...v, nameEn: e.target.value }))}
          />
        </FormField>
        <FormField label={labels.nameBn} htmlFor="zone-name-bn" required>
          <TextInput
            id="zone-name-bn"
            value={values.nameBn}
            disabled={isSaving}
            onChange={(e) => onValuesChange((v) => ({ ...v, nameBn: e.target.value }))}
          />
        </FormField>
      </div>
    </>
  );
}

interface SettingsGroupProps {
  readonly labels: DeliveryZoneLabels;
  readonly isSaving: boolean;
  readonly currency: CurrencyCode;
  readonly values: FormValues;
  readonly status: DeliveryZoneStatus;
  readonly onValuesChange: (updater: (prev: FormValues) => FormValues) => void;
  readonly onStatusChange: (status: DeliveryZoneStatus) => void;
}

function ZoneSettingsGroup(props: SettingsGroupProps): ReactElement {
  const { labels, isSaving, currency, values, status, onValuesChange, onStatusChange } = props;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={`${labels.fee} (${currency})`} htmlFor="zone-fee" required>
          <TextInput
            id="zone-fee"
            inputMode="decimal"
            value={values.feeText}
            disabled={isSaving}
            onChange={(e) => onValuesChange((v) => ({ ...v, feeText: e.target.value }))}
          />
        </FormField>
        <FormField label={labels.status} htmlFor="zone-status">
          <Select
            id="zone-status"
            value={status}
            disabled={isSaving}
            onChange={(e) => onStatusChange(e.target.value as DeliveryZoneStatus)}
          >
            <option value={DELIVERY_ZONE_STATUS.ACTIVE}>{labels.statusActive}</option>
            <option value={DELIVERY_ZONE_STATUS.INACTIVE}>{labels.statusInactive}</option>
          </Select>
        </FormField>
      </div>
      <FormField label={labels.areaCodes} htmlFor="zone-area-codes" hint={labels.areaCodesPlaceholder} required>
        <TextInput
          id="zone-area-codes"
          value={values.areaCodesText}
          disabled={isSaving}
          onChange={(e) => onValuesChange((v) => ({ ...v, areaCodesText: e.target.value }))}
        />
      </FormField>
    </>
  );
}

export function DeliveryZoneForm(props: DeliveryZoneFormProps): ReactElement {
  const { labels, zone, organizationId, currency } = props;
  const isEditing = zone !== undefined;
  const [values, setValues] = useState<FormValues>(() => initialFormValues(zone));
  const [status, setStatus] = useState<DeliveryZoneStatus>(zone?.status ?? DELIVERY_ZONE_STATUS.ACTIVE);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submitForm(): Promise<void> {
    setErrorMessage(null);
    const validated = validateZoneValues(values, currency, labels);
    if (!validated.data) {
      setErrorMessage(validated.error ?? labels.failed);
      return;
    }
    setIsSaving(true);
    try {
      const saved = await persistDeliveryZone({ organizationId, zone, data: validated.data, status });
      props.onSaved(saved);
    } catch (error) {
      const err = error as { readonly message?: string };
      setErrorMessage(err.message || labels.failed);
    } finally {
      setIsSaving(false);
    }
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    void submitForm();
  }

  const title = isEditing ? labels.editTitle : labels.createTitle;
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-default bg-surface p-4">
      <h3 className="text-title font-semibold text-primary">{title}</h3>
      <ZoneNamesGroup
        labels={labels}
        isEditing={isEditing}
        isSaving={isSaving}
        values={values}
        onValuesChange={setValues}
      />
      <ZoneSettingsGroup
        labels={labels}
        isSaving={isSaving}
        currency={currency}
        values={values}
        status={status}
        onValuesChange={setValues}
        onStatusChange={setStatus}
      />
      {errorMessage ? <p role="alert" className="text-body text-danger">{errorMessage}</p> : null}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" disabled={isSaving} onClick={props.onCancel}>{labels.cancel}</Button>
        <Button isLoading={isSaving} type="submit">{labels.save}</Button>
      </div>
    </form>
  );
}

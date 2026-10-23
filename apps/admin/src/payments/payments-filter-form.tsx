"use client";

import {
  ACCEPTED_PAYMENT_METHODS,
  PAYMENT_DIRECTION,
  type PaymentDirection,
  type PaymentMethod,
} from "@banijjik/contracts/payment";
import { Button, FormField, Select, TextInput } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import type { PaymentLabels } from "./payment-labels";
import { paymentsApiQuery, type PaymentsQuery } from "./payment-query";

export interface PaymentsFilterFormProps {
  readonly query: PaymentsQuery;
  readonly basePath: string;
  readonly locations: readonly { readonly locationId: string; readonly name: string }[];
  readonly labels: PaymentLabels;
}

interface SelectFiltersProps {
  readonly method: string;
  readonly direction: string;
  readonly locationId: string;
  readonly locations: readonly { readonly locationId: string; readonly name: string }[];
  readonly labels: PaymentLabels;
  readonly onMethodChange: (val: string) => void;
  readonly onDirectionChange: (val: string) => void;
  readonly onLocationChange: (val: string) => void;
}

function SelectFilters(props: SelectFiltersProps): ReactElement {
  const {
    method,
    direction,
    locationId,
    locations,
    labels,
    onMethodChange,
    onDirectionChange,
    onLocationChange,
  } = props;
  return (
    <>
      <FormField label={labels.filter.method} htmlFor="filter-method">
        <Select id="filter-method" value={method} onChange={(e) => onMethodChange(e.target.value)}>
          <option value="">{labels.filter.methodAll}</option>
          {ACCEPTED_PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {labels.method[m] ?? m}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label={labels.filter.direction} htmlFor="filter-direction">
        <Select
          id="filter-direction"
          value={direction}
          onChange={(e) => onDirectionChange(e.target.value)}
        >
          <option value="">{labels.filter.directionAll}</option>
          {Object.values(PAYMENT_DIRECTION).map((d) => (
            <option key={d} value={d}>
              {labels.direction[d] ?? d}
            </option>
          ))}
        </Select>
      </FormField>

      {locations.length > 0 ? (
        <FormField label={labels.filter.location} htmlFor="filter-location">
          <Select
            id="filter-location"
            value={locationId}
            onChange={(e) => onLocationChange(e.target.value)}
          >
            <option value="">{labels.filter.locationAll}</option>
            {locations.map((loc) => (
              <option key={loc.locationId} value={loc.locationId}>
                {loc.name}
              </option>
            ))}
          </Select>
        </FormField>
      ) : null}
    </>
  );
}

export function PaymentsFilterForm(props: PaymentsFilterFormProps): ReactElement {
  const router = useRouter();
  const [method, setMethod] = useState<string>(props.query.method ?? "");
  const [direction, setDirection] = useState<string>(props.query.direction ?? "");
  const [locationId, setLocationId] = useState<string>(props.query.locationId ?? "");
  const [from, setFrom] = useState<string>(props.query.from ?? "");
  const [to, setTo] = useState<string>(props.query.to ?? "");

  function handleApply(e: React.FormEvent): void {
    e.preventDefault();
    const updatedQuery: PaymentsQuery = {
      page: 1,
      limit: props.query.limit,
      method: (method as PaymentMethod) || undefined,
      direction: (direction as PaymentDirection) || undefined,
      locationId: locationId || undefined,
      from: from || undefined,
      to: to || undefined,
    };
    const search = paymentsApiQuery(updatedQuery);
    router.push(search ? `${props.basePath}?${search}` : props.basePath);
  }

  function handleReset(): void {
    setMethod("");
    setDirection("");
    setLocationId("");
    setFrom("");
    setTo("");
    router.push(props.basePath);
  }

  return (
    <form
      onSubmit={handleApply}
      className="grid grid-cols-1 gap-3 rounded-lg border border-default bg-surface p-4 sm:grid-cols-2 md:grid-cols-5"
    >
      <SelectFilters
        method={method}
        direction={direction}
        locationId={locationId}
        locations={props.locations}
        labels={props.labels}
        onMethodChange={setMethod}
        onDirectionChange={setDirection}
        onLocationChange={setLocationId}
      />
      <FormField label={props.labels.filter.from} htmlFor="filter-from">
        <TextInput
          id="filter-from"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </FormField>
      <FormField label={props.labels.filter.to} htmlFor="filter-to">
        <TextInput id="filter-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </FormField>
      <div className="flex items-end gap-2 sm:col-span-2 md:col-span-5 md:justify-end">
        <Button type="button" variant="secondary" onClick={handleReset}>
          {props.labels.filter.reset}
        </Button>
        <Button type="submit">{props.labels.filter.apply}</Button>
      </div>
    </form>
  );
}

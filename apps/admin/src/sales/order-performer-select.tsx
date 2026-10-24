"use client";

import type { SalesPerformerResponse } from "@banijjik/contracts/sales";
import { FormField, Select } from "@banijjik/ui";
import { useEffect, useState, type ReactElement } from "react";
import { listPerformers } from "./order-api";
import type { OrderLineLabels } from "./order-label-types";

export type OrderPerformerLabels = Pick<
  OrderLineLabels,
  "performer" | "performerNone" | "performerLoadFailed" | "performerUnknown"
>;

export interface OrderPerformerSelectProps {
  readonly organizationId: string;
  readonly locationId: string;
  readonly id: string;
  readonly value: string | null;
  readonly disabled: boolean;
  readonly labels: OrderPerformerLabels;
  readonly onChange: (memberId: string | null) => void;
}

interface PerformerList {
  readonly performers: readonly SalesPerformerResponse[];
  readonly loadFailed: boolean;
}

/** The members of the location, loaded when the select opens; a failed load keeps the select usable. */
function usePerformerList(organizationId: string, locationId: string): PerformerList {
  const [list, setList] = useState<PerformerList>({ performers: [], loadFailed: false });
  useEffect(() => {
    let isCurrent = true;
    async function load(): Promise<void> {
      try {
        const performers = await listPerformers(organizationId, locationId);
        if (isCurrent) setList({ performers, loadFailed: false });
      } catch {
        if (isCurrent) setList({ performers: [], loadFailed: true });
      }
    }
    void load();
    return () => {
      isCurrent = false;
    };
  }, [organizationId, locationId]);
  return list;
}

/** A former staff member keeps their place on the line, shown with a neutral label. */
function performerOptions(
  list: PerformerList,
  value: string | null,
  labels: OrderPerformerLabels,
): ReactElement[] {
  const options = list.performers.map((performer) => (
    <option key={performer.memberId} value={performer.memberId}>
      {performer.name}
    </option>
  ));
  const known = list.performers.some((performer) => performer.memberId === value);
  if (value !== null && !known && !list.loadFailed) {
    options.push(
      <option key={value} value={value}>
        {labels.performerUnknown}
      </option>,
    );
  }
  return options;
}

export function OrderPerformerSelect(props: OrderPerformerSelectProps): ReactElement {
  const list = usePerformerList(props.organizationId, props.locationId);
  return (
    <FormField
      label={props.labels.performer}
      htmlFor={props.id}
      {...(list.loadFailed ? { error: props.labels.performerLoadFailed } : {})}
    >
      <Select
        id={props.id}
        value={props.value ?? ""}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value === "" ? null : event.target.value)}
      >
        <option value="">{props.labels.performerNone}</option>
        {performerOptions(list, props.value, props.labels)}
      </Select>
    </FormField>
  );
}

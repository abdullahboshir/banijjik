"use client";

import type { SalesPerformerResponse } from "@banijjik/contracts/sales";
import { FormField, Select } from "@banijjik/ui";
import { useEffect, useState, type ReactElement } from "react";
import { listSalePerformers } from "./pos-api";
import type { PosLabels } from "./pos-labels";

export interface PosPerformerSelectProps {
  readonly organizationId: string;
  readonly locationId: string;
  readonly id: string;
  readonly value: string | null;
  readonly labels: PosLabels;
  readonly onChange: (memberId: string | null, name: string | null) => void;
}

interface PerformerList {
  readonly performers: readonly SalesPerformerResponse[];
  readonly loadFailed: boolean;
}

function usePerformerList(organizationId: string, locationId: string): PerformerList {
  const [list, setList] = useState<PerformerList>({ performers: [], loadFailed: false });
  useEffect(() => {
    let isCurrent = true;
    async function load(): Promise<void> {
      try {
        const performers = await listSalePerformers(organizationId, locationId);
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

function optionsOf(list: PerformerList, value: string | null, labels: PosLabels): ReactElement[] {
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

function nameOf(list: PerformerList, memberId: string | null): string | null {
  if (memberId === null) return null;
  return list.performers.find((performer) => performer.memberId === memberId)?.name ?? null;
}

/** Staff of the till's location who may be named on a walk-in service line (plan 3.40 decision 12). */
export function PosPerformerSelect(props: PosPerformerSelectProps): ReactElement {
  const list = usePerformerList(props.organizationId, props.locationId);
  return (
    <FormField
      label={props.labels.performedBy}
      htmlFor={props.id}
      {...(list.loadFailed ? { error: props.labels.performerLoadFailed } : {})}
    >
      <Select
        id={props.id}
        className="min-h-14"
        value={props.value ?? ""}
        onChange={(event) => {
          const memberId = event.target.value === "" ? null : event.target.value;
          props.onChange(memberId, nameOf(list, memberId));
        }}
      >
        <option value="">{props.labels.performerNone}</option>
        {optionsOf(list, props.value, props.labels)}
      </Select>
    </FormField>
  );
}

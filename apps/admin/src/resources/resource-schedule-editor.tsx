"use client";

import type { Weekday } from "@banijjik/contracts/booking";
import { WEEKDAYS } from "@banijjik/contracts/booking";
import { Button, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import { applyMondayToWeek, type WeekdayScheduleRow } from "./resource-schedule";

export interface ResourceScheduleEditorProps {
  rows: readonly WeekdayScheduleRow[];
  weekdayLabel: (weekday: Weekday) => string;
  opensLabel: string;
  closesLabel: string;
  copyWeekLabel: string;
  onChange: (rows: WeekdayScheduleRow[]) => void;
}

export function ResourceScheduleEditor(props: ResourceScheduleEditorProps): ReactElement {
  function patchRow(weekday: Weekday, patch: Partial<WeekdayScheduleRow>): void {
    props.onChange(props.rows.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row)));
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="secondary"
        onClick={() => props.onChange(applyMondayToWeek(props.rows))}
      >
        {props.copyWeekLabel}
      </Button>
      <ul className="flex flex-col gap-3">
        {WEEKDAYS.map((weekday) => {
          const row = props.rows.find((candidate) => candidate.weekday === weekday) ?? {
            weekday,
            opensAt: "",
            closesAt: "",
          };
          return (
            <li key={weekday} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr]">
              <span className="min-h-11 content-center text-body text-primary">
                {props.weekdayLabel(weekday)}
              </span>
              <label className="flex flex-col gap-1">
                <span className="text-small text-secondary">{props.opensLabel}</span>
                <TextInput
                  type="time"
                  value={row.opensAt}
                  onChange={(event) => patchRow(weekday, { opensAt: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-small text-secondary">{props.closesLabel}</span>
                <TextInput
                  type="time"
                  value={row.closesAt}
                  onChange={(event) => patchRow(weekday, { closesAt: event.target.value })}
                />
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

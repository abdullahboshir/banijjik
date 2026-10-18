"use client";

import type { EventDeadLetterStatus } from "@banijjik/contracts";
import { DataList, EmptyState, type DataListColumn, type StatusTone } from "@banijjik/ui";
import type { ReactElement } from "react";
import { StatusPill } from "../shell/status-pill";
import { DeadLetterRowActions } from "./dead-letter-actions";
import type { FailedEventLabels } from "./failed-event-labels";

export interface DeadLetterRowView {
  eventDeadLetterId: string;
  eventType: string;
  handlerKey: string;
  organizationLabel: string;
  errorSummary: string;
  attemptsLabel: string;
  whenLabel: string;
  status: EventDeadLetterStatus;
  statusLabel: string;
  statusTone: StatusTone;
  /** "Waiting behind this" line for an ORDERED handler's stream; empty otherwise. */
  waitingNote: string;
  canAct: boolean;
}

function columnsOf(labels: FailedEventLabels): DataListColumn<DeadLetterRowView>[] {
  return [
    {
      columnKey: "event",
      header: labels["platform.failedEvents.column.event"],
      isPrimary: true,
      cell: (row) => (
        <span className="flex flex-col">
          <span>{row.eventType}</span>
          {row.waitingNote ? (
            <span className="text-caption text-secondary">{row.waitingNote}</span>
          ) : null}
        </span>
      ),
    },
    {
      columnKey: "organization",
      header: labels["platform.failedEvents.column.organization"],
      cell: (row) => row.organizationLabel,
    },
    {
      columnKey: "handler",
      header: labels["platform.failedEvents.column.handler"],
      isPrimary: true,
      cell: (row) => row.handlerKey,
    },
    {
      columnKey: "error",
      header: labels["platform.failedEvents.column.error"],
      cell: (row) => `${row.errorSummary} · ${row.attemptsLabel}`,
    },
    {
      columnKey: "when",
      header: labels["platform.failedEvents.column.when"],
      cell: (row) => row.whenLabel,
    },
    {
      columnKey: "status",
      header: labels["platform.failedEvents.column.status"],
      isPrimary: true,
      cell: (row) => <StatusPill tone={row.statusTone} label={row.statusLabel} />,
    },
    {
      columnKey: "actions",
      header: labels["platform.failedEvents.column.actions"],
      isPrimary: true,
      cell: (row) => (row.canAct ? <HandlerActions row={row} labels={labels} /> : null),
    },
  ];
}

/** Replay and Skip of a handler that failed. */
function HandlerActions({
  row,
  labels,
}: {
  row: DeadLetterRowView;
  labels: FailedEventLabels;
}): ReactElement {
  return (
    <DeadLetterRowActions
      labels={labels}
      targets={[
        {
          target: { kind: "replay", eventDeadLetterId: row.eventDeadLetterId },
          label: labels["platform.failedEvents.action.replay"],
          isDanger: false,
        },
        {
          target: { kind: "skip", eventDeadLetterId: row.eventDeadLetterId },
          label: labels["platform.failedEvents.action.skip"],
          isDanger: true,
        },
      ]}
    />
  );
}

/** Handlers that failed their last attempt: cards below md, a table from md up. */
export function DeadLetterList({
  rows,
  labels,
}: {
  rows: DeadLetterRowView[];
  labels: FailedEventLabels;
}): ReactElement {
  return (
    <DataList
      columns={columnsOf(labels)}
      rows={rows}
      rowKey={(row) => row.eventDeadLetterId}
      emptyState={<EmptyState message={labels["platform.failedEvents.handlers.empty"]} />}
    />
  );
}

export interface DeadOutboxRowView {
  eventId: string;
  eventType: string;
  organizationLabel: string;
  errorSummary: string;
  attemptsLabel: string;
  whenLabel: string;
  canAct: boolean;
}

function outboxColumnsOf(labels: FailedEventLabels): DataListColumn<DeadOutboxRowView>[] {
  return [
    {
      columnKey: "event",
      header: labels["platform.failedEvents.column.event"],
      isPrimary: true,
      cell: (row) => row.eventType,
    },
    {
      columnKey: "organization",
      header: labels["platform.failedEvents.column.organization"],
      cell: (row) => row.organizationLabel,
    },
    {
      columnKey: "error",
      header: labels["platform.failedEvents.column.error"],
      isPrimary: true,
      cell: (row) => `${row.errorSummary} · ${row.attemptsLabel}`,
    },
    {
      columnKey: "when",
      header: labels["platform.failedEvents.column.when"],
      cell: (row) => row.whenLabel,
    },
    {
      columnKey: "actions",
      header: labels["platform.failedEvents.column.actions"],
      isPrimary: true,
      cell: (row) =>
        row.canAct ? (
          <DeadLetterRowActions
            labels={labels}
            targets={[
              {
                target: { kind: "outbox", eventId: row.eventId },
                label: labels["platform.failedEvents.action.replay"],
                isDanger: false,
              },
            ]}
          />
        ) : null,
    },
  ];
}

/** Events that could not be handed to the queue: not dispatched at all. */
export function DeadOutboxList({
  rows,
  labels,
}: {
  rows: DeadOutboxRowView[];
  labels: FailedEventLabels;
}): ReactElement {
  return (
    <DataList
      columns={outboxColumnsOf(labels)}
      rows={rows}
      rowKey={(row) => row.eventId}
      emptyState={<EmptyState message={labels["platform.failedEvents.outbox.empty"]} />}
    />
  );
}

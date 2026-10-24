import type { ReactElement } from "react";
import type { EventSessionView } from "./event-session-api";
import { EventSessionCancelButton, EventSessionSheetButton } from "./event-session-buttons";
import type { EventSessionSheetProps } from "./event-session-sheet";

export interface EventSessionListProps {
  organizationId: string;
  sessions: readonly {
    session: EventSessionView;
    title: string;
    startsAtText: string;
    seatsSoldText: string;
    statusText: string;
  }[];
  editLabel: string;
  cancelLabel: string;
  canUpdate: boolean;
  canCancel: boolean;
  sheetBase: Omit<EventSessionSheetProps, "onClose" | "existing">;
}

/** Seats sold come straight from the session the server just read: the client never counts them. */
export function EventSessionList(props: EventSessionListProps): ReactElement {
  return (
    <ul className="flex flex-col gap-3">
      {props.sessions.map((row) => {
        const isScheduled = row.session.status === "SCHEDULED";
        const hasActions = isScheduled && (props.canUpdate || props.canCancel);
        return (
          <li
            key={row.session.eventSessionId}
            data-testid="event-session-row"
            className="flex flex-col gap-3 rounded-md border border-default bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-primary">{row.title}</h2>
              <p className="text-small text-secondary">{row.startsAtText}</p>
              <p className="text-small text-secondary">
                {row.seatsSoldText} · {row.statusText}
              </p>
            </div>
            {hasActions ? (
              <div className="flex flex-wrap gap-2">
                {props.canUpdate ? (
                  <EventSessionSheetButton
                    label={props.editLabel}
                    variant="secondary"
                    sheetProps={{ ...props.sheetBase, existing: row.session }}
                  />
                ) : null}
                {props.canCancel ? (
                  <EventSessionCancelButton
                    label={props.cancelLabel}
                    dialogProps={{ organizationId: props.organizationId, session: row.session }}
                  />
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

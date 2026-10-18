"use client";

import { Button } from "@banijjik/ui";
import { useLazyComponent } from "@banijjik/web-client/client";
import { useState, type ComponentType, type ReactElement } from "react";
import type { DeadLetterSheetProps, DeadLetterSheetTarget } from "./dead-letter-sheets";
import type { FailedEventLabels } from "./failed-event-labels";

async function loadSheet(): Promise<ComponentType<DeadLetterSheetProps>> {
  const sheetModule = await import("./dead-letter-sheets");
  return sheetModule.DeadLetterSheet;
}

export interface DeadLetterRowActionsProps {
  /** Replay and Skip for a handler that failed; Replay alone for an outbox event. */
  targets: ReadonlyArray<{ target: DeadLetterSheetTarget; label: string; isDanger: boolean }>;
  labels: FailedEventLabels;
}

/** The buttons of one row. The confirm sheet loads on the first tap. */
export function DeadLetterRowActions({ targets, labels }: DeadLetterRowActionsProps): ReactElement {
  const [open, setOpen] = useState<DeadLetterSheetTarget | undefined>();
  const Sheet = useLazyComponent(loadSheet, open !== undefined);
  return (
    <div className="flex flex-wrap gap-2">
      {targets.map(({ target, label, isDanger }) => (
        <Button
          key={target.kind}
          variant={isDanger ? "danger" : "secondary"}
          onClick={() => setOpen(target)}
        >
          {label}
        </Button>
      ))}
      {Sheet && open ? (
        <Sheet target={open} labels={labels} onClose={() => setOpen(undefined)} />
      ) : null}
    </div>
  );
}

"use client";

import type { ComponentType, ReactElement } from "react";
import { LazySheetButton } from "../settings/lazy-sheet-button";
import type { EventSessionCancelDialogProps } from "./event-session-cancel-dialog";
import type { EventSessionSheetProps } from "./event-session-sheet";

async function loadSheet(): Promise<ComponentType<EventSessionSheetProps>> {
  const loaded = await import("./event-session-sheet");
  return loaded.EventSessionSheet;
}

async function loadCancelDialog(): Promise<ComponentType<EventSessionCancelDialogProps>> {
  const loaded = await import("./event-session-cancel-dialog");
  return loaded.EventSessionCancelDialog;
}

/** Create and edit share one lazy sheet; its code loads on the first tap (13-UX section 11). */
export function EventSessionSheetButton(props: {
  label: string;
  variant?: "primary" | "secondary";
  sheetProps: Omit<EventSessionSheetProps, "onClose">;
}): ReactElement {
  return (
    <LazySheetButton
      label={props.label}
      variant={props.variant ?? "primary"}
      load={loadSheet}
      sheetProps={props.sheetProps}
    />
  );
}

export function EventSessionCancelButton(props: {
  label: string;
  dialogProps: Omit<EventSessionCancelDialogProps, "onClose">;
}): ReactElement {
  return (
    <LazySheetButton
      label={props.label}
      variant="secondary"
      load={loadCancelDialog}
      sheetProps={props.dialogProps}
    />
  );
}

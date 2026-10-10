"use client";

import type { ReactElement } from "react";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

/** Undo stays available for 5 seconds (13-UX section 5). */
export const UNDO_DURATION_MS = 5000;

export interface ToastOptions {
  undo?: { label: string; onUndo: () => void };
}

function show(kind: "success" | "error", message: string, options?: ToastOptions): void {
  const undo = options?.undo;
  if (!undo) {
    sonnerToast[kind](message);
    return;
  }
  sonnerToast[kind](message, {
    duration: UNDO_DURATION_MS,
    action: { label: undo.label, onClick: undo.onUndo },
  });
}

export const toast = {
  success: (message: string, options?: ToastOptions): void => show("success", message, options),
  error: (message: string, options?: ToastOptions): void => show("error", message, options),
};

/** Sonner renders an aria-live region; `label` names it for screen readers. */
export function Toaster({ label }: { label: string }): ReactElement {
  return (
    <SonnerToaster
      position="bottom-center"
      containerAriaLabel={label}
      style={{ zIndex: "var(--token-z-toast)" }}
    />
  );
}

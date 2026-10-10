"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { cn } from "../lib/cn.js";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const FADE_ANIMATION =
  "data-[state=open]:animate-[ui-fade-in_var(--token-motion-medium)_ease-out] data-[state=closed]:animate-[ui-fade-out_var(--token-motion-medium)_ease-out]";

/** The overlay and the content of one surface must share a layer, so the content (later in the DOM) paints above it. */
export function DialogOverlay({ className = "z-dialog" }: { className?: string }): ReactElement {
  return (
    <DialogPrimitive.Overlay
      className={cn("fixed inset-0 bg-primary/40", className, FADE_ANIMATION)}
    />
  );
}

export interface DialogFrameProps {
  title: string;
  description?: string | undefined;
  closeLabel: string;
  children?: ReactNode;
  className?: string;
}

/** Shared header for dialogs and sheets: visible title, optional description, labelled close button. */
export function DialogHeader({
  title,
  description,
  closeLabel,
}: Pick<DialogFrameProps, "title" | "description" | "closeLabel">): ReactElement {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <DialogPrimitive.Title className="text-title font-semibold text-primary">
          {title}
        </DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-1 text-small text-secondary">
            {description}
          </DialogPrimitive.Description>
        ) : null}
      </div>
      <DialogPrimitive.Close
        aria-label={closeLabel}
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-secondary transition-colors hover:bg-subtle"
      >
        <X aria-hidden="true" className="size-5" />
      </DialogPrimitive.Close>
    </div>
  );
}

/** Radix warns when a dialog has no Description; opting out explicitly is the documented fix. */
export function descriptionProps(description: string | undefined): {
  "aria-describedby"?: undefined;
} {
  return description ? {} : { "aria-describedby": undefined };
}

export function DialogContent({
  title,
  description,
  closeLabel,
  children,
  className,
}: DialogFrameProps): ReactElement {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        {...descriptionProps(description)}
        className={cn(
          "fixed left-1/2 top-1/2 z-dialog flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg bg-surface p-5 shadow-lg",
          "data-[state=open]:animate-[ui-zoom-in_var(--token-motion-medium)_ease-out] data-[state=closed]:animate-[ui-zoom-out_var(--token-motion-medium)_ease-out]",
          className,
        )}
      >
        <DialogHeader title={title} description={description} closeLabel={closeLabel} />
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

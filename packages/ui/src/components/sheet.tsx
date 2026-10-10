"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ReactElement } from "react";
import { cn } from "../lib/cn.js";
import {
  Dialog,
  DialogHeader,
  DialogOverlay,
  descriptionProps,
  type DialogFrameProps,
} from "./dialog.js";

export const Sheet = Dialog;

/** A bottom sheet below the md breakpoint and a centred dialog from it up; the switch is CSS only. */
export function SheetContent({
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
          "fixed inset-x-0 bottom-0 z-sheet flex max-h-[85dvh] flex-col gap-4 overflow-y-auto rounded-t-lg bg-surface p-5 shadow-lg",
          "data-[state=open]:animate-[ui-slide-up_var(--token-motion-medium)_ease-out] data-[state=closed]:animate-[ui-slide-down_var(--token-motion-medium)_ease-out]",
          "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:z-dialog md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg",
          className,
        )}
      >
        <DialogHeader title={title} description={description} closeLabel={closeLabel} />
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

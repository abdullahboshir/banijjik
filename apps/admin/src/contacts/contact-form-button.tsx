"use client";

import type { ComponentType, ReactElement } from "react";
import { LazySheetButton } from "../settings/lazy-sheet-button";
import type { ContactFormSheetProps } from "./contact-form-sheet";

export interface ContactFormButtonProps {
  label: string;
  variant?: "primary" | "secondary";
  sheetProps: Omit<ContactFormSheetProps, "onClose">;
}

async function loadSheet(): Promise<ComponentType<ContactFormSheetProps>> {
  const sheetModule = await import("./contact-form-sheet");
  return sheetModule.ContactFormSheet;
}

/** The "New contact" and "Edit" buttons; the form and its code load on the first tap. */
export function ContactFormButton(props: ContactFormButtonProps): ReactElement {
  return (
    <LazySheetButton
      label={props.label}
      {...(props.variant ? { variant: props.variant } : {})}
      load={loadSheet}
      sheetProps={props.sheetProps}
    />
  );
}

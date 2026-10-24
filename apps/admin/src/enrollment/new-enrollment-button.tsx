"use client";

import type { ComponentType, ReactElement } from "react";
import { LazySheetButton } from "../settings/lazy-sheet-button";
import type { NewEnrollmentSheetProps } from "./new-enrollment-sheet";

export interface NewEnrollmentButtonProps {
  label: string;
  sheetProps: Omit<NewEnrollmentSheetProps, "onClose">;
}

async function loadSheet(): Promise<ComponentType<NewEnrollmentSheetProps>> {
  const sheetModule = await import("./new-enrollment-sheet");
  return sheetModule.NewEnrollmentSheet;
}

/** The sheet's code loads on the first tap, so the list route stays within its first-load budget. */
export function NewEnrollmentButton(props: NewEnrollmentButtonProps): ReactElement {
  return <LazySheetButton label={props.label} load={loadSheet} sheetProps={props.sheetProps} />;
}

"use client";

import type { ComponentType, ReactElement } from "react";
import { LazySheetButton } from "../settings/lazy-sheet-button";
import type { ExpenseFormSheetProps } from "./expense-form-sheet";

export interface ExpenseFormButtonProps {
  label: string;
  sheetProps: Omit<ExpenseFormSheetProps, "onClose">;
}

async function loadSheet(): Promise<ComponentType<ExpenseFormSheetProps>> {
  const sheetModule = await import("./expense-form-sheet");
  return sheetModule.ExpenseFormSheet;
}

/** The "Add expense" button; the form and its code load on the first tap. */
export function ExpenseFormButton(props: ExpenseFormButtonProps): ReactElement {
  return <LazySheetButton label={props.label} load={loadSheet} sheetProps={props.sheetProps} />;
}

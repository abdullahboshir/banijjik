"use client";

import type { ComponentType, ReactElement } from "react";
import { LazySheetButton } from "../settings/lazy-sheet-button";
import type { EditMemberDetailsSheetProps } from "./edit-member-details-sheet";

export interface EditMemberDetailsButtonProps {
  label: string;
  sheetProps: Omit<EditMemberDetailsSheetProps, "onClose">;
}

async function loadSheet(): Promise<ComponentType<EditMemberDetailsSheetProps>> {
  const sheetModule = await import("./edit-member-details-sheet");
  return sheetModule.EditMemberDetailsSheet;
}

/** The "Edit details" button of a member's page; the form loads on the first tap. */
export function EditMemberDetailsButton({
  label,
  sheetProps,
}: EditMemberDetailsButtonProps): ReactElement {
  return (
    <LazySheetButton label={label} variant="secondary" load={loadSheet} sheetProps={sheetProps} />
  );
}

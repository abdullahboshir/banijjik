"use client";

import type { ComponentType, ReactElement } from "react";
import { LazySheetButton } from "../settings/lazy-sheet-button";
import type { ProfileFormSheetProps } from "./profile-form-sheet";

export interface EditProfileButtonProps {
  label: string;
  sheetProps: Omit<ProfileFormSheetProps, "onClose">;
}

async function loadSheet(): Promise<ComponentType<ProfileFormSheetProps>> {
  const sheetModule = await import("./profile-form-sheet");
  return sheetModule.ProfileFormSheet;
}

/** The "Edit" button of the business profile; the form loads on the first tap. */
export function EditProfileButton({ label, sheetProps }: EditProfileButtonProps): ReactElement {
  return <LazySheetButton label={label} load={loadSheet} sheetProps={sheetProps} />;
}

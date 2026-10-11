"use client";

import type { ComponentType, ReactElement } from "react";
import { LazySheetButton } from "../settings/lazy-sheet-button";
import type { RoleFormSheetProps } from "./role-form-sheet";
import type { RoleFormGroup, RoleFormLabels } from "./role-labels";

export interface NewRoleButtonProps {
  organizationId: string;
  label: string;
  groups: RoleFormGroup[];
  labels: RoleFormLabels;
}

async function loadSheet(): Promise<ComponentType<RoleFormSheetProps>> {
  const sheetModule = await import("./role-form-sheet");
  return sheetModule.RoleFormSheet;
}

/** The "New role" button; the form loads on the first tap. */
export function NewRoleButton(props: NewRoleButtonProps): ReactElement {
  return (
    <LazySheetButton
      label={props.label}
      load={loadSheet}
      sheetProps={{
        organizationId: props.organizationId,
        initialName: "",
        groups: props.groups,
        labels: props.labels,
      }}
    />
  );
}

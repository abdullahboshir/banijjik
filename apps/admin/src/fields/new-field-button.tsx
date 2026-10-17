"use client";

import type { CustomFieldEntityType } from "@banijjik/contracts";
import type { ComponentType, ReactElement } from "react";
import { LazySheetButton } from "../settings/lazy-sheet-button";
import { emptyFieldForm } from "./field-form";
import type { FieldFormSheetProps } from "./field-form-sheet";
import type { FieldLabels } from "./field-labels";

export interface NewFieldButtonProps {
  organizationId: string;
  entityType: CustomFieldEntityType;
  label: string;
  /** The sort order the new field starts with: after the last one. */
  sortOrder: number;
  labels: FieldLabels;
}

async function loadSheet(): Promise<ComponentType<FieldFormSheetProps>> {
  const sheetModule = await import("./field-form-sheet");
  return sheetModule.FieldFormSheet;
}

/** The "Add field" button; the form loads on the first tap. */
export function NewFieldButton(props: NewFieldButtonProps): ReactElement {
  return (
    <LazySheetButton
      label={props.label}
      load={loadSheet}
      sheetProps={{
        organizationId: props.organizationId,
        entityType: props.entityType,
        initial: emptyFieldForm(props.sortOrder),
        labels: props.labels,
      }}
    />
  );
}

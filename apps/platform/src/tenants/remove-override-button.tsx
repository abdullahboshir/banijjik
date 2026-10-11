"use client";

import { Button } from "@banijjik/ui";
import { useState, type ComponentType, type ReactElement } from "react";
import { useLazyComponent } from "../lib/use-lazy-component";
import type { RemoveOverrideDialogProps } from "./remove-override-dialog";
import type { RemoveOverrideLabels } from "./remove-override-labels";

export interface RemoveOverrideButtonProps {
  organizationId: string;
  moduleOverrideId: string;
  labels: RemoveOverrideLabels;
}

async function loadDialog(): Promise<ComponentType<RemoveOverrideDialogProps>> {
  const dialogModule = await import("./remove-override-dialog");
  return dialogModule.RemoveOverrideDialog;
}

/** The "Remove" button of one override row; the confirmation loads on the first tap. */
export function RemoveOverrideButton(props: RemoveOverrideButtonProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const Dialog = useLazyComponent(loadDialog, isOpen);
  return (
    <>
      <Button variant="ghost" onClick={() => setIsOpen(true)}>
        {props.labels["platform.override.remove"]}
      </Button>
      {Dialog && isOpen ? <Dialog {...props} onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}

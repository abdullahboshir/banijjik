"use client";

import { Button } from "@banijjik/ui";
import { useState, type ComponentType, type ReactElement } from "react";
import { useLazyComponent } from "../lib/use-lazy-component";
import type { AssignmentOptions } from "../staff/assignment-options";
import type { InvitationFormSheetProps } from "./invitation-form-sheet";
import type { InviteLabels } from "./invite-labels";

export interface NewInvitationButtonProps {
  organizationId: string;
  options: AssignmentOptions;
  labels: InviteLabels;
  buttonLabel: string;
}

async function loadSheet(): Promise<ComponentType<InvitationFormSheetProps>> {
  const sheetModule = await import("./invitation-form-sheet");
  return sheetModule.InvitationFormSheet;
}

/** The "New invitation" button; the form and its code load on the first tap. */
export function NewInvitationButton(props: NewInvitationButtonProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const Sheet = useLazyComponent(loadSheet, isOpen);
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>{props.buttonLabel}</Button>
      {Sheet && isOpen ? (
        <Sheet
          organizationId={props.organizationId}
          options={props.options}
          labels={props.labels}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}

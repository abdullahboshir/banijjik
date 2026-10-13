"use client";

import { useLazyComponent } from "@banijjik/web-client/client";
import { Button, StickyActionBar } from "@banijjik/ui";
import { useState, type ComponentType, type ReactElement } from "react";
import type { AssignmentOptions } from "./assignment-options";
import type { MemberActionDialogsProps } from "./member-action-dialogs";
import type { MemberAction, MemberActionLabels, MemberSummary } from "./member-action-labels";

export interface MemberActionsProps {
  organizationId: string;
  member: MemberSummary;
  /** Only the actions this person may do now (permission, status); the API checks again. */
  actions: MemberAction[];
  options: AssignmentOptions | undefined;
  labels: MemberActionLabels;
}

async function loadDialogs(): Promise<ComponentType<MemberActionDialogsProps>> {
  const dialogsModule = await import("./member-action-dialogs");
  return dialogsModule.MemberActionDialogs;
}

const VARIANT: Record<MemberAction, "primary" | "secondary" | "danger"> = {
  editAssignments: "primary",
  suspend: "secondary",
  reactivate: "primary",
  remove: "danger",
};

/** The sticky bar of a member's detail page. Dialogs and the form load on the first tap. */
export function MemberActions(props: MemberActionsProps): ReactElement | null {
  const { actions, labels } = props;
  const [openAction, setOpenAction] = useState<MemberAction | undefined>();
  const Dialogs = useLazyComponent(loadDialogs, openAction !== undefined);
  if (actions.length === 0) return null;
  return (
    <>
      <StickyActionBar label={labels.group}>
        {actions.map((action) => (
          <Button key={action} variant={VARIANT[action]} onClick={() => setOpenAction(action)}>
            {labels.actions[action]}
          </Button>
        ))}
      </StickyActionBar>
      {Dialogs && openAction ? (
        <Dialogs {...props} openAction={openAction} onClose={() => setOpenAction(undefined)} />
      ) : null}
    </>
  );
}

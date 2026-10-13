"use client";

import { useLazyComponent } from "@banijjik/web-client/client";
import { Button, StickyActionBar } from "@banijjik/ui";
import { useState, type ComponentType, type ReactElement } from "react";
import type { RoleArchiveDialogProps } from "./role-archive-dialog";
import type { RoleFormSheetProps } from "./role-form-sheet";
import type { RoleArchiveLabels, RoleFormGroup, RoleFormLabels } from "./role-labels";

export type RoleAction = "edit" | "archive";

export interface RoleActionsProps {
  organizationId: string;
  role: { roleId: string; name: string; version: number };
  /** Only the actions this person may do now (permission, status, custom role); the API checks again. */
  actions: RoleAction[];
  groups: RoleFormGroup[];
  preservedKeys: string[];
  formLabels: RoleFormLabels;
  archiveLabels: RoleArchiveLabels;
  labels: { group: string; edit: string; archive: string };
}

async function loadSheet(): Promise<ComponentType<RoleFormSheetProps>> {
  const sheetModule = await import("./role-form-sheet");
  return sheetModule.RoleFormSheet;
}

async function loadArchiveDialog(): Promise<ComponentType<RoleArchiveDialogProps>> {
  const dialogModule = await import("./role-archive-dialog");
  return dialogModule.RoleArchiveDialog;
}

/** The sticky bar of a role page. The form and the dialog load on the first tap. */
export function RoleActions(props: RoleActionsProps): ReactElement | null {
  const { organizationId, role, actions, labels } = props;
  const [openAction, setOpenAction] = useState<RoleAction | undefined>();
  const Sheet = useLazyComponent(loadSheet, openAction === "edit");
  const ArchiveDialog = useLazyComponent(loadArchiveDialog, openAction === "archive");
  if (actions.length === 0) return null;
  const close = (): void => setOpenAction(undefined);
  return (
    <>
      <StickyActionBar label={labels.group}>
        {actions.includes("edit") ? (
          <Button onClick={() => setOpenAction("edit")}>{labels.edit}</Button>
        ) : null}
        {actions.includes("archive") ? (
          <Button variant="danger" onClick={() => setOpenAction("archive")}>
            {labels.archive}
          </Button>
        ) : null}
      </StickyActionBar>
      {Sheet && openAction === "edit" ? (
        <Sheet
          organizationId={organizationId}
          initialName={role.name}
          groups={props.groups}
          preservedKeys={props.preservedKeys}
          role={{ roleId: role.roleId, version: role.version }}
          labels={props.formLabels}
          onClose={close}
        />
      ) : null}
      {ArchiveDialog && openAction === "archive" ? (
        <ArchiveDialog
          organizationId={organizationId}
          roleId={role.roleId}
          version={role.version}
          labels={props.archiveLabels}
          onClose={close}
        />
      ) : null}
    </>
  );
}

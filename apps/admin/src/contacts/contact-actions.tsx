"use client";

import { Button, StickyActionBar } from "@banijjik/ui";
import { useLazyComponent } from "@banijjik/web-client/client";
import { useState, type ComponentType, type ReactElement, type ReactNode } from "react";
import type {
  ContactAction,
  ContactActionDialogsProps,
  ContactActionLabels,
} from "./contact-action-dialogs";

export interface ContactActionsProps {
  organizationId: string;
  contactId: string;
  version: number;
  /** Only the actions this person may do now (permission, status); the API checks again. */
  actions: ContactAction[];
  /** The edit button, built by the server because it carries the form's data. */
  editButton: ReactNode;
  groupLabel: string;
  archiveLabel: string;
  anonymizeLabel: string;
  labels: ContactActionLabels;
}

async function loadDialogs(): Promise<ComponentType<ContactActionDialogsProps>> {
  const dialogsModule = await import("./contact-action-dialogs");
  return dialogsModule.ContactActionDialogs;
}

/** The sticky bar of a contact's detail page. Dialogs load on the first tap. */
export function ContactActions(props: ContactActionsProps): ReactElement | null {
  const [openAction, setOpenAction] = useState<ContactAction | undefined>(undefined);
  const Dialogs = useLazyComponent(loadDialogs, openAction !== undefined);
  if (props.actions.length === 0 && props.editButton === null) return null;
  return (
    <>
      <StickyActionBar label={props.groupLabel}>
        {props.editButton}
        {props.actions.includes("archive") ? (
          <Button variant="secondary" onClick={() => setOpenAction("archive")}>
            {props.archiveLabel}
          </Button>
        ) : null}
        {props.actions.includes("anonymize") ? (
          <Button variant="danger" onClick={() => setOpenAction("anonymize")}>
            {props.anonymizeLabel}
          </Button>
        ) : null}
      </StickyActionBar>
      {Dialogs && openAction ? (
        <Dialogs
          organizationId={props.organizationId}
          contactId={props.contactId}
          version={props.version}
          labels={props.labels}
          openAction={openAction}
          onClose={() => setOpenAction(undefined)}
        />
      ) : null}
    </>
  );
}

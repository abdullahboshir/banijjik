"use client";

import { Button } from "@banijjik/ui";
import { useLazyComponent } from "@banijjik/web-client/client";
import { useState, type ComponentType, type ReactElement } from "react";
import type { WebsiteLoginChange } from "./website-login-api";
import type { WebsiteLoginDialogProps } from "./website-login-dialog";
import type { WebsiteLoginLabels } from "./website-login-labels";

export interface WebsiteLoginActionsProps {
  organizationId: string;
  contactId: string;
  version: number;
  /** The one change that makes sense now: block an active login, unblock a blocked one. */
  change: WebsiteLoginChange;
  buttonLabel: string;
  labels: WebsiteLoginLabels;
}

async function loadDialog(): Promise<ComponentType<WebsiteLoginDialogProps>> {
  const dialogModule = await import("./website-login-dialog");
  return dialogModule.WebsiteLoginDialog;
}

/** The Block or Unblock button of the "Website login" section. The dialog loads on the first tap. */
export function WebsiteLoginActions(props: WebsiteLoginActionsProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const Dialog = useLazyComponent(loadDialog, isOpen);
  return (
    <>
      <Button
        variant={props.change === "block" ? "danger" : "secondary"}
        onClick={() => setIsOpen(true)}
      >
        {props.buttonLabel}
      </Button>
      {Dialog && isOpen ? (
        <Dialog
          organizationId={props.organizationId}
          contactId={props.contactId}
          version={props.version}
          change={props.change}
          labels={props.labels}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}

"use client";

import { Button, FormField, TextInput } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import type { InviteLabels } from "./invite-labels";

export interface InviteLinkPanelProps {
  /** The path the API returned, such as `/invitations/{token}`; it is shown once and never stored. */
  linkPath: string;
  labels: InviteLabels;
  onDone: () => void;
}

type CopyState = "idle" | "copied" | "failed";

function fullLink(linkPath: string): string {
  return new URL(linkPath, window.location.origin).toString();
}

/** The invitation link, shown once with a copy button (the API keeps only its hash). */
export function InviteLinkPanel({ linkPath, labels, onDone }: InviteLinkPanelProps): ReactElement {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const link = fullLink(linkPath);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(link);
      setCopyState("copied");
    } catch {
      // Clipboard access can be refused (insecure page, permissions); the field stays selectable by hand.
      setCopyState("failed");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-secondary">{labels.linkHint}</p>
      <FormField label={labels.linkField} htmlFor="invite-link">
        <TextInput
          id="invite-link"
          readOnly
          value={link}
          onFocus={(event) => event.target.select()}
        />
      </FormField>
      <Button variant="secondary" onClick={() => void copy()}>
        {labels.copy}
      </Button>
      <p role="status" className="text-small text-secondary">
        {copyState === "copied" ? labels.copied : null}
        {copyState === "failed" ? labels.copyFailed : null}
      </p>
      <Button onClick={onDone}>{labels.done}</Button>
    </div>
  );
}

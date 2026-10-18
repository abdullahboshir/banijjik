"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { Button, ConfirmDialog, FormField, Sheet, SheetContent, TextInput } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { anonymizeContact, archiveContact } from "./contact-api";

export type ContactAction = "archive" | "anonymize";

export interface ContactActionLabels {
  close: string;
  cancel: string;
  conflict: string;
  archive: { title: string; description: string; confirm: string };
  anonymize: {
    title: string;
    description: string;
    reason: string;
    /** "Type {word} to confirm", with the word filled in. */
    typeToConfirm: string;
    confirmWord: string;
    confirm: string;
  };
}

export interface ContactActionDialogsProps {
  organizationId: string;
  contactId: string;
  version: number;
  labels: ContactActionLabels;
  openAction: ContactAction;
  onClose: () => void;
}

/** What a refused action says: the stale-version text, or the API's message key. */
function useRefusal(labels: ContactActionLabels): {
  message: string | undefined;
  refuse: (error: unknown) => void;
} {
  const { t } = useTranslator();
  const [message, setMessage] = useState<string | undefined>(undefined);
  return {
    message,
    refuse: (error) => {
      if (!(error instanceof ApiError)) throw error;
      setMessage(
        error.code === ERROR_CODE.CONFLICT
          ? labels.conflict
          : t(knownMessageKeyOrInternal(error.messageKey)),
      );
    },
  };
}

function ArchiveConfirmation(props: ContactActionDialogsProps): ReactElement {
  const { labels } = props;
  const router = useRouter();
  const refusal = useRefusal(labels);
  async function run(): Promise<void> {
    try {
      await archiveContact(props.organizationId, props.contactId, props.version);
      props.onClose();
      router.refresh();
    } catch (error) {
      refusal.refuse(error);
    }
  }
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => (open ? undefined : props.onClose())}
      title={labels.archive.title}
      description={refusal.message ?? labels.archive.description}
      confirmLabel={labels.archive.confirm}
      cancelLabel={labels.cancel}
      closeLabel={labels.close}
      tone="danger"
      onConfirm={() => void run()}
    />
  );
}

/** Erasure is irreversible, so it asks for a reason and for a typed word before it sends anything (ADR-110). */
function AnonymizeDialog(props: ContactActionDialogsProps): ReactElement {
  const { labels } = props;
  const text = labels.anonymize;
  const router = useRouter();
  const refusal = useRefusal(labels);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const isReady = reason.trim() !== "" && typed.trim() === text.confirmWord;
  async function run(): Promise<void> {
    try {
      await anonymizeContact(props.organizationId, props.contactId, {
        version: props.version,
        reason: reason.trim(),
      });
      props.onClose();
      router.refresh();
    } catch (error) {
      refusal.refuse(error);
    }
  }
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent
        title={text.title}
        description={refusal.message ?? text.description}
        closeLabel={labels.close}
      >
        <FormField label={text.reason} htmlFor="anonymize-reason" required>
          <TextInput
            id="anonymize-reason"
            value={reason}
            autoComplete="off"
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>
        <FormField label={text.typeToConfirm} htmlFor="anonymize-confirm" required>
          <TextInput
            id="anonymize-confirm"
            value={typed}
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
          />
        </FormField>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={props.onClose}>
            {labels.cancel}
          </Button>
          <Button variant="danger" disabled={!isReady} onClick={() => void run()}>
            {text.confirm}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Loaded on the first tap of an action, so none of this is in the first load of the route. */
export function ContactActionDialogs(props: ContactActionDialogsProps): ReactElement {
  return props.openAction === "archive" ? (
    <ArchiveConfirmation {...props} />
  ) : (
    <AnonymizeDialog {...props} />
  );
}

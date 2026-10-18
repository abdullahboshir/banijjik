"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { ConfirmDialog } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { changeWebsiteLogin, type WebsiteLoginChange } from "./website-login-api";
import type { WebsiteLoginLabels } from "./website-login-labels";

export interface WebsiteLoginDialogProps {
  organizationId: string;
  contactId: string;
  version: number;
  change: WebsiteLoginChange;
  labels: WebsiteLoginLabels;
  onClose: () => void;
}

/** Asks before it blocks or unblocks, and says why a refusal happened. Loaded on the first tap. */
export function WebsiteLoginDialog(props: WebsiteLoginDialogProps): ReactElement {
  const { labels, change } = props;
  const { t } = useTranslator();
  const router = useRouter();
  const [refusal, setRefusal] = useState<string | undefined>(undefined);
  const text = labels[change];
  async function run(): Promise<void> {
    try {
      await changeWebsiteLogin(props.organizationId, props.contactId, {
        change,
        version: props.version,
      });
      props.onClose();
      router.refresh();
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      setRefusal(
        error.code === ERROR_CODE.CONFLICT
          ? labels.conflict
          : t(knownMessageKeyOrInternal(error.messageKey)),
      );
    }
  }
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => (open ? undefined : props.onClose())}
      title={text.title}
      description={refusal ?? text.description}
      confirmLabel={text.confirm}
      cancelLabel={labels.cancel}
      closeLabel={labels.close}
      tone={change === "block" ? "danger" : "default"}
      onConfirm={() => void run()}
    />
  );
}

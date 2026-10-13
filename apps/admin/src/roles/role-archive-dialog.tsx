"use client";

import { useTranslator } from "@banijjik/web-client/client";
import { ERROR_CODE, ROLE_RULE_KEY } from "@banijjik/contracts";
import { ConfirmDialog } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { archiveRole } from "./role-api";
import type { RoleArchiveLabels } from "./role-labels";

export interface RoleArchiveDialogProps {
  organizationId: string;
  roleId: string;
  version: number;
  labels: RoleArchiveLabels;
  onClose: () => void;
}

/**
 * Confirms the archive. A role that members still hold is refused with ROLE_IN_USE, which the dialog
 * shows as "N members still have this role"; any other refusal shows the message the API sent.
 */
export function RoleArchiveDialog(props: RoleArchiveDialogProps): ReactElement {
  const { organizationId, roleId, version, labels, onClose } = props;
  const { t } = useTranslator();
  const router = useRouter();
  const [refusal, setRefusal] = useState<string | undefined>();
  const [isConflict, setIsConflict] = useState(false);

  function refusalText(error: ApiError): string {
    if (error.code === ERROR_CODE.CONFLICT) return labels.conflict;
    if (error.details?.["ruleKey"] === ROLE_RULE_KEY.ROLE_IN_USE) return labels.inUse;
    return t(knownMessageKeyOrInternal(error.messageKey));
  }

  async function run(): Promise<void> {
    try {
      await archiveRole(organizationId, roleId, version);
      onClose();
      router.refresh();
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      setIsConflict(error.code === ERROR_CODE.CONFLICT);
      setRefusal(refusalText(error));
    }
  }

  function handleOpenChange(open: boolean): void {
    if (open) return;
    onClose();
    // After a conflict the page shows the old version; reloading gives the next attempt the current one.
    if (isConflict) router.refresh();
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={handleOpenChange}
      title={labels.title}
      description={refusal ?? labels.description}
      confirmLabel={labels.confirm}
      cancelLabel={labels.cancel}
      closeLabel={labels.close}
      tone="danger"
      onConfirm={() => void run()}
    />
  );
}

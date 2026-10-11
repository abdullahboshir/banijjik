"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { ConfirmDialog } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { changeMemberStatus } from "../lib/api/organization-api";
import { useTranslator } from "../lib/i18n/i18n-provider";
import type { AssignmentOptions } from "./assignment-options";
import { EditAssignmentsSheet } from "./edit-assignments-sheet";
import type { MemberAction, MemberActionLabels, MemberSummary } from "./member-action-labels";

export interface MemberActionDialogsProps {
  organizationId: string;
  member: MemberSummary;
  options: AssignmentOptions | undefined;
  labels: MemberActionLabels;
  openAction: MemberAction;
  onClose: () => void;
}

type StatusAction = Exclude<MemberAction, "editAssignments">;

/** Confirmation of suspend, reactivate and remove. A refusal stays in the dialog, in place of its description. */
function StatusConfirmation(
  props: MemberActionDialogsProps & { action: StatusAction },
): ReactElement {
  const { organizationId, member, labels, action, onClose } = props;
  const { t } = useTranslator();
  const router = useRouter();
  const [refusal, setRefusal] = useState<string | undefined>();
  const [isConflict, setIsConflict] = useState(false);

  async function run(): Promise<void> {
    try {
      await changeMemberStatus({
        organizationId,
        memberId: member.memberId,
        action,
        version: member.version,
      });
      onClose();
      router.refresh();
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      const conflict = error.code === ERROR_CODE.CONFLICT;
      setIsConflict(conflict);
      setRefusal(conflict ? labels.conflict : t(knownMessageKeyOrInternal(error.messageKey)));
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
      title={labels.confirm[action].title}
      description={refusal ?? labels.confirm[action].description}
      confirmLabel={labels.actions[action]}
      cancelLabel={labels.cancel}
      closeLabel={labels.close}
      tone={action === "remove" ? "danger" : "default"}
      onConfirm={() => void run()}
    />
  );
}

/** Loaded on the first tap of an action, so none of this is in the first load of the route. */
export function MemberActionDialogs(props: MemberActionDialogsProps): ReactElement | null {
  if (props.openAction === "editAssignments") {
    return props.options ? <EditAssignmentsSheet {...props} options={props.options} /> : null;
  }
  return <StatusConfirmation {...props} action={props.openAction} />;
}

"use client";

import { useTranslator } from "@banijjik/web-client/client";
import { Button, Sheet, SheetContent } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { updateMember } from "../lib/api/organization-api";
import { failureOfAssignmentError, type AssignmentFailure } from "./assignment-errors";
import type { AssignmentOptions } from "./assignment-options";
import { AssignmentRowsEditor } from "./assignment-rows-editor";
import { toAssignmentRequests, toRows, validateRows, type AssignmentRow } from "./assignment-rows";
import type { MemberActionLabels, MemberSummary } from "./member-action-labels";

export interface EditAssignmentsSheetProps {
  organizationId: string;
  member: MemberSummary;
  options: AssignmentOptions;
  labels: MemberActionLabels;
  onClose: () => void;
}

const NO_FAILURE: AssignmentFailure = { rowErrors: {}, isConflict: false };

function FailureMessages({
  failure,
  labels,
  onReload,
}: {
  failure: AssignmentFailure;
  labels: MemberActionLabels;
  onReload: () => void;
}): ReactElement {
  const { t } = useTranslator();
  return (
    <>
      {failure.isConflict ? (
        <div role="alert" className="flex flex-col gap-2 text-small text-danger">
          <p>{labels.conflict}</p>
          <Button variant="secondary" onClick={onReload}>
            {labels.reload}
          </Button>
        </div>
      ) : null}
      {failure.formMessageKey ? (
        <p role="alert" className="text-small text-danger">
          {t(knownMessageKeyOrInternal(failure.formMessageKey))}
        </p>
      ) : null}
    </>
  );
}

/** The assignments form of 13-UX section 4.3 for one member; a stale version is a 409 with a reload hint. */
export function EditAssignmentsSheet(props: EditAssignmentsSheetProps): ReactElement {
  const { organizationId, member, options, labels, onClose } = props;
  const router = useRouter();
  const [rows, setRows] = useState<AssignmentRow[]>(() => toRows(member.assignments));
  const [failure, setFailure] = useState<AssignmentFailure>(NO_FAILURE);
  const [isSaving, setIsSaving] = useState(false);

  async function save(): Promise<void> {
    const found = validateRows(rows, options.isSingleLocation);
    setFailure({ rowErrors: found, isConflict: false });
    if (Object.keys(found).length > 0) return;
    setIsSaving(true);
    try {
      await updateMember(organizationId, member.memberId, {
        assignments: toAssignmentRequests(rows, options.isSingleLocation),
        version: member.version,
      });
      onClose();
      router.refresh();
      return;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      setFailure(failureOfAssignmentError(error, rows));
    }
    setIsSaving(false);
  }

  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent title={labels.actions.editAssignments} closeLabel={labels.close}>
        <AssignmentRowsEditor
          idPrefix="edit"
          rows={rows}
          options={options}
          errors={failure.rowErrors}
          labels={labels.assignments}
          onChange={setRows}
        />
        <FailureMessages failure={failure} labels={labels} onReload={() => router.refresh()} />
        <Button isLoading={isSaving} onClick={() => void save()}>
          {labels.save}
        </Button>
      </SheetContent>
    </Sheet>
  );
}

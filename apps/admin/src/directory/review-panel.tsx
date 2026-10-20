"use client";

import type { DirectoryConfigResponse } from "@banijjik/contracts/directory";
import type { Locale } from "@banijjik/i18n";
import type { ReactElement } from "react";
import { RejectForm } from "./reject-form";
import { ReviewChecklist } from "./review-checklist";
import type { ReviewActionsLabels } from "./review-actions";
import { ReviewToolbar } from "./review-toolbar";

type Panel = "none" | "approve" | "reject";

export function ReviewPanelBody(props: {
  panel: Panel;
  busy: boolean;
  conflict: boolean;
  status: string;
  canReview: boolean;
  canHide: boolean;
  reasons: DirectoryConfigResponse["rejectionReasons"];
  locale: Locale;
  labels: ReviewActionsLabels;
  onPanel: (panel: Panel) => void;
  onReject: (input: { reasonKeys: readonly string[]; note?: string }) => void;
  onHide: () => void;
  onUnhide: () => void;
}): ReactElement {
  const { labels } = props;
  return (
    <div className="flex flex-col gap-4">
      {props.conflict ? (
        <p
          className="rounded-md border border-warning bg-subtle p-3 text-small text-warning"
          role="alert"
        >
          {labels.versionConflict}
        </p>
      ) : null}
      <ReviewChecklist
        reasons={props.reasons}
        locale={props.locale}
        title={labels.checklistTitle}
        help={labels.checklistHelp}
        noneApplyLabel={labels.noneApply}
      />
      {props.panel === "reject" ? (
        <RejectForm
          reasons={props.reasons}
          locale={props.locale}
          labels={labels.rejectForm}
          busy={props.busy}
          onCancel={() => props.onPanel("none")}
          onSubmit={props.onReject}
        />
      ) : null}
      <ReviewToolbar
        status={props.status}
        canReview={props.canReview}
        canHide={props.canHide}
        busy={props.busy}
        labels={labels}
        onPanel={props.onPanel}
        onHide={props.onHide}
        onUnhide={props.onUnhide}
      />
    </div>
  );
}

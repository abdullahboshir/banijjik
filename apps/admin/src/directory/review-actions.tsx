"use client";

import type { DirectoryConfigResponse } from "@banijjik/contracts/directory";
import type { Locale } from "@banijjik/i18n";
import { ConfirmDialog } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { createReviewHandlers } from "./review-action-handlers";
import type { RejectFormLabels } from "./reject-form";
import { ReviewPanelBody } from "./review-panel";

export interface ReviewActionsLabels {
  approve: string;
  approveConfirmTitle: string;
  approveConfirmDescription: string;
  reject: string;
  hide: string;
  unhide: string;
  confirm: string;
  cancel: string;
  close: string;
  versionConflict: string;
  checklistTitle: string;
  checklistHelp: string;
  noneApply: string;
  rejectForm: RejectFormLabels;
}

export interface ReviewActionsProps {
  organizationId: string;
  listingId: string;
  version: number;
  status: string;
  canReview: boolean;
  canHide: boolean;
  reasons: DirectoryConfigResponse["rejectionReasons"];
  locale: Locale;
  labels: ReviewActionsLabels;
  queueHref: string;
}

type Panel = "none" | "approve" | "reject";

/** Approve, reject, hide/unhide for the staff review page. */
export function ReviewActions(props: ReviewActionsProps): ReactElement {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>("none");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const { labels } = props;
  const handlers = createReviewHandlers({
    organizationId: props.organizationId,
    listingId: props.listingId,
    version: props.version,
    queueHref: props.queueHref,
    setBusy,
    setConflict,
    setPanel,
    push: (href) => router.push(href),
    refresh: () => router.refresh(),
  });

  return (
    <>
      <ReviewPanelBody
        panel={panel}
        busy={busy}
        conflict={conflict}
        status={props.status}
        canReview={props.canReview}
        canHide={props.canHide}
        reasons={props.reasons}
        locale={props.locale}
        labels={labels}
        onPanel={setPanel}
        onReject={handlers.onReject}
        onHide={handlers.onHide}
        onUnhide={handlers.onUnhide}
      />
      <ConfirmDialog
        open={panel === "approve"}
        onOpenChange={(open) => setPanel(open ? "approve" : "none")}
        title={labels.approveConfirmTitle}
        description={labels.approveConfirmDescription}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        closeLabel={labels.close}
        tone="default"
        onConfirm={handlers.onApprove}
      />
    </>
  );
}

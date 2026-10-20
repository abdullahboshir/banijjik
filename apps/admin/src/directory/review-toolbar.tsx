"use client";

import { Button, StickyActionBar } from "@banijjik/ui";
import type { ReactElement } from "react";

type Panel = "none" | "approve" | "reject";

export function ReviewToolbar(props: {
  status: string;
  canReview: boolean;
  canHide: boolean;
  busy: boolean;
  labels: { approve: string; reject: string; hide: string; unhide: string };
  onPanel: (panel: Panel) => void;
  onHide: () => void;
  onUnhide: () => void;
}): ReactElement {
  const { labels } = props;
  return (
    <StickyActionBar label={labels.approve}>
      {props.canReview && props.status === "SUBMITTED" ? (
        <>
          <Button variant="primary" disabled={props.busy} onClick={() => props.onPanel("approve")}>
            {labels.approve}
          </Button>
          <Button variant="danger" disabled={props.busy} onClick={() => props.onPanel("reject")}>
            {labels.reject}
          </Button>
        </>
      ) : null}
      {props.canHide && props.status === "APPROVED" ? (
        <Button variant="secondary" disabled={props.busy} onClick={props.onHide}>
          {labels.hide}
        </Button>
      ) : null}
      {props.canHide && props.status === "HIDDEN" ? (
        <Button variant="secondary" disabled={props.busy} onClick={props.onUnhide}>
          {labels.unhide}
        </Button>
      ) : null}
    </StickyActionBar>
  );
}

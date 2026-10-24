"use client";

import { Button, ContactLinkInput } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import type { ReactElement } from "react";
import { useCheckIn, type CheckInOutcome } from "./use-check-in";

export interface CheckInPanelLabels {
  readonly record: string;
  readonly done: string;
}

function OutcomeNote(props: { outcome: CheckInOutcome; doneLabel: string }): ReactElement | null {
  const { t } = useTranslator();
  const { outcome } = props;
  if (outcome.kind === "done") {
    return (
      <p role="status" className="text-small text-success">
        {props.doneLabel}
      </p>
    );
  }
  if (outcome.kind === "failed") {
    return (
      <p role="alert" className="text-small text-danger">
        {t(outcome.messageKey)}
      </p>
    );
  }
  return null;
}

export function CheckInPanel(props: {
  organizationId: string;
  locationId: string;
  labels: CheckInPanelLabels;
}): ReactElement {
  const checkIn = useCheckIn(props);
  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-default bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void checkIn.submit();
      }}
    >
      <ContactLinkInput
        id="check-in-contact"
        value={checkIn.contact}
        onChange={checkIn.setContact}
        search={checkIn.link.search}
        labels={checkIn.link.labels}
      />
      <Button type="submit" isLoading={checkIn.isSaving} disabled={checkIn.contact === null}>
        {props.labels.record}
      </Button>
      <OutcomeNote outcome={checkIn.outcome} doneLabel={props.labels.done} />
    </form>
  );
}

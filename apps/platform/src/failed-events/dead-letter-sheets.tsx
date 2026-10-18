"use client";

import { platformEventSkipRequestSchema } from "@banijjik/validation";
import { useState, type ReactElement } from "react";
import { replayDeadLetter, replayDeadOutboxEvent, skipDeadLetter } from "../api/platform-api";
import { FormSheet } from "../forms/form-sheet";
import { ReasonField } from "../forms/reason-field";
import { issuesToFieldErrors } from "../forms/schema-errors";
import { useFinishAction } from "../forms/use-finish-action";
import { useFormSubmit } from "../forms/use-form-submit";
import type { FailedEventLabels } from "./failed-event-labels";

export type DeadLetterSheetTarget =
  | { kind: "replay"; eventDeadLetterId: string }
  | { kind: "skip"; eventDeadLetterId: string }
  | { kind: "outbox"; eventId: string };

export interface DeadLetterSheetProps {
  target: DeadLetterSheetTarget;
  labels: FailedEventLabels;
  onClose: () => void;
}

function SkipSheet(props: {
  eventDeadLetterId: string;
  labels: FailedEventLabels;
  onClose: () => void;
}): ReactElement {
  const { labels } = props;
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const submit = useFormSubmit();
  const finish = useFinishAction(props.onClose);

  async function handleSubmit(): Promise<void> {
    const parsed = platformEventSkipRequestSchema.safeParse({ reason });
    setReasonError(
      parsed.success ? undefined : issuesToFieldErrors(parsed.error.issues, { reason })["reason"],
    );
    if (!parsed.success) return;
    const saved = await submit.run(() => skipDeadLetter(props.eventDeadLetterId, parsed.data));
    if (saved) await finish(labels["platform.failedEvents.sheet.skip.success"]);
  }

  return (
    <FormSheet
      title={labels["platform.failedEvents.sheet.skip.title"]}
      description={labels["platform.failedEvents.sheet.skip.description"]}
      submitLabel={labels["platform.failedEvents.action.skip"]}
      isDanger
      isSubmitting={submit.isSubmitting}
      failure={submit.failure}
      onSubmit={() => void handleSubmit()}
      onClose={props.onClose}
    >
      <ReasonField
        fieldId="skip-reason"
        label={labels["platform.failedEvents.field.skipReason"]}
        hint={labels["platform.failedEvents.field.skipReasonHint"]}
        value={reason}
        errorKey={reasonError}
        onChange={setReason}
      />
    </FormSheet>
  );
}

function ReplaySheet(props: {
  target: Exclude<DeadLetterSheetTarget, { kind: "skip" }>;
  labels: FailedEventLabels;
  onClose: () => void;
}): ReactElement {
  const { target, labels } = props;
  const submit = useFormSubmit();
  const finish = useFinishAction(props.onClose);
  const sheetKey = target.kind === "outbox" ? "outbox" : "replay";

  async function handleSubmit(): Promise<void> {
    const saved = await submit.run(() =>
      target.kind === "outbox"
        ? replayDeadOutboxEvent(target.eventId)
        : replayDeadLetter(target.eventDeadLetterId),
    );
    if (saved) await finish(labels[`platform.failedEvents.sheet.${sheetKey}.success`]);
  }

  return (
    <FormSheet
      title={labels[`platform.failedEvents.sheet.${sheetKey}.title`]}
      description={labels[`platform.failedEvents.sheet.${sheetKey}.description`]}
      submitLabel={labels["platform.failedEvents.action.replay"]}
      isSubmitting={submit.isSubmitting}
      failure={submit.failure}
      onSubmit={() => void handleSubmit()}
      onClose={props.onClose}
    >
      {null}
    </FormSheet>
  );
}

/** The confirm sheet of Replay (nothing to fill in) or Skip (a reason is required). Loaded on the first tap. */
export function DeadLetterSheet({ target, labels, onClose }: DeadLetterSheetProps): ReactElement {
  if (target.kind === "skip") {
    return (
      <SkipSheet eventDeadLetterId={target.eventDeadLetterId} labels={labels} onClose={onClose} />
    );
  }
  return <ReplaySheet target={target} labels={labels} onClose={onClose} />;
}

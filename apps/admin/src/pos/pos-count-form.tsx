"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import {
  POS_SESSION_NOTE_MAX_LENGTH,
  type PosSessionResponse,
  type PosZReport,
} from "@banijjik/contracts/pos";
import type { PosSessionCloseBody } from "@banijjik/validation/pos";
import { Button, TextInput } from "@banijjik/ui";
import { useRef, useState, type FormEvent, type ReactElement } from "react";
import { attemptFor, type CheckoutAttempt } from "./attempt-key";
import { buildCloseBody } from "./close-register";
import type { PosLabels } from "./pos-labels";
import { closeSession, fetchZReport } from "./pos-api";

export interface PosCountFormProps {
  readonly organizationId: string;
  readonly session: PosSessionResponse;
  readonly currency: CurrencyCode;
  readonly labels: PosLabels;
  readonly onBack: () => void;
  readonly onClosed: (report: PosZReport) => void;
}

/**
 * Closes the register and reads its Z-report. The close and the read share one key per attempt, so a
 * retry after a lost answer replays the first close instead of closing again (ADR-014).
 */
async function closeAndReadReport(
  organizationId: string,
  session: PosSessionResponse,
  request: { readonly body: PosSessionCloseBody; readonly idempotencyKey: string },
): Promise<PosZReport> {
  const closed = await closeSession(organizationId, session.posSessionId, request);
  return fetchZReport(organizationId, closed.posSessionId);
}

function CountFields(props: {
  readonly labels: PosLabels;
  readonly countedText: string;
  readonly noteText: string;
  readonly onCountedChange: (text: string) => void;
  readonly onNoteChange: (text: string) => void;
}): ReactElement {
  const { labels, countedText, noteText, onCountedChange, onNoteChange } = props;
  return (
    <>
      <label className="flex flex-col gap-1 text-body font-semibold text-primary">
        {labels.closeLabels.counted}
        <TextInput
          inputMode="decimal"
          value={countedText}
          onChange={(event) => onCountedChange(event.target.value.trim())}
          className="min-h-14 text-h3"
        />
      </label>
      <label className="flex flex-col gap-1 text-body font-semibold text-primary">
        {labels.closeLabels.note}
        <TextInput
          value={noteText}
          maxLength={POS_SESSION_NOTE_MAX_LENGTH}
          onChange={(event) => onNoteChange(event.target.value)}
          className="min-h-14"
        />
      </label>
    </>
  );
}

/** The counting form: the counted cash and an optional note, then the close. */
export function PosCountForm(props: PosCountFormProps): ReactElement {
  const { organizationId, session, currency, labels, onBack, onClosed } = props;
  const [countedText, setCountedText] = useState("0");
  const [noteText, setNoteText] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const attemptRef = useRef<CheckoutAttempt | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const body = buildCloseBody({ countedText, noteText, version: session.version, currency });
    if (!body) {
      setFailed(true);
      return;
    }
    const attempt = attemptFor(attemptRef.current, JSON.stringify(body));
    attemptRef.current = attempt;
    setPending(true);
    setFailed(false);
    try {
      const report = await closeAndReadReport(organizationId, session, {
        body,
        idempotencyKey: attempt.idempotencyKey,
      });
      onClosed(report);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="mx-auto flex w-full max-w-md flex-col gap-4 p-4"
    >
      <h1 className="text-h2 font-semibold text-primary">{labels.closeLabels.title}</h1>
      <CountFields
        labels={labels}
        countedText={countedText}
        noteText={noteText}
        onCountedChange={setCountedText}
        onNoteChange={setNoteText}
      />
      {failed ? (
        <p role="alert" className="text-body text-danger">
          {labels.closeLabels.failed}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" className="min-h-14 flex-1" onClick={onBack}>
          {labels.closeLabels.back}
        </Button>
        <Button type="submit" className="min-h-14 flex-1" isLoading={pending}>
          {labels.closeLabels.submit}
        </Button>
      </div>
    </form>
  );
}

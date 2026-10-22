"use client";
import { lazy, Suspense, useRef, useState, type ReactElement } from "react";
import { newId } from "@banijjik/ids";
import { Button, FormField, Sheet, SheetContent, TextInput, formatMoney } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import type { JournalEntryResponse } from "@banijjik/contracts/accounting";
import { apiFetch } from "../lib/api/api-client";
import { ApiError } from "../lib/api/api-error";
import type { JournalViewProps } from "./journal-view";
const JournalApproval = lazy(() => import("./journal-approval"));
interface DetailProps extends JournalViewProps {
  entry: JournalEntryResponse;
  onClose: () => void;
}
export default function JournalDetail(props: DetailProps): ReactElement {
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <SheetContent title={props.entry.entryNumber} closeLabel={props.labels.close}>
        <p>{props.entry.memo}</p>
        <div className="flex flex-col gap-3">
          {props.entry.lines.map((line, index) => (
            <article key={index} className="rounded-lg border border-default p-3">
              <p>{line.accountCode}</p>
              <p>
                {props.labels.debit}: {formatMoney(line.debit, { locale: props.locale })}
              </p>
              <p>
                {props.labels.credit}: {formatMoney(line.credit, { locale: props.locale })}
              </p>
            </article>
          ))}
        </div>
        {props.canReverse && <ReversalForm {...props} />}
      </SheetContent>
    </Sheet>
  );
}
function ReversalForm(props: DetailProps): ReactElement {
  const {
    date,
    setDate,
    confirm,
    setConfirm,
    approval,
    setApproval,
    error,
    pending,
    operation,
    reverse,
  } = useReversal(props);
  const labels = props.labels;
  return (
    <div className="flex flex-col gap-3">
      <Button variant="secondary" onClick={() => setConfirm(true)}>
        {labels.reverse}
      </Button>
      {confirm && (
        <>
          <p>{labels.reverseWarning}</p>
          <FormField label={labels.date} htmlFor="reverse-date">
            <TextInput
              id="reverse-date"
              type="date"
              value={date}
              max={props.today}
              disabled={pending}
              onChange={(event) => {
                setDate(event.target.value);
                operation.current = { key: newId(), token: undefined };
              }}
            />
          </FormField>
          <Button
            disabled={pending}
            onClick={() => {
              void reverse();
            }}
          >
            {pending ? labels.pending : labels.confirm}
          </Button>
        </>
      )}
      <ReversalError message={error} />
      <ReversalApproval
        {...props}
        date={date}
        approval={approval}
        onCancel={() => setApproval(false)}
        onApproved={(token) => {
          setApproval(false);
          void reverse(token);
        }}
      />
    </div>
  );
}

function useReversal(props: DetailProps) {
  const [date, setDate] = useState(props.today);
  const [confirm, setConfirm] = useState(false);
  const [approval, setApproval] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const operation = useRef({ key: newId(), token: undefined as string | undefined });
  const router = useRouter();
  const labels = props.labels;
  async function reverse(token?: string): Promise<void> {
    if (token !== undefined) operation.current.token = token;
    setPending(true);
    setError("");
    try {
      await apiFetch(
        `/orgs/${props.organizationId}/bookkeeping/journal/${props.entry.journalEntryId}/reverse`,
        {
          method: "POST",
          body: {
            businessDate: date,
            ...(operation.current.token === undefined
              ? {}
              : { approvalToken: operation.current.token }),
          },
          idempotencyKey: operation.current.key,
        },
      );
      props.onClose();
      router.refresh();
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === "APPROVAL_REQUIRED") setApproval(true);
      else setError(labels.failure);
    } finally {
      setPending(false);
    }
  }
  return {
    date,
    setDate,
    confirm,
    setConfirm,
    approval,
    setApproval,
    error,
    pending,
    operation,
    reverse,
  };
}

function ReversalApproval(
  props: DetailProps & {
    date: string;
    approval: boolean;
    onCancel: () => void;
    onApproved: (token: string) => void;
  },
): ReactElement | null {
  if (!props.approval) return null;
  return (
    <Suspense fallback={<p role="status">{props.labels.pending}</p>}>
      <JournalApproval
        organizationId={props.organizationId}
        userId={props.userId}
        locationId={props.entry.locationId ?? ""}
        subjectContent=""
        reverseSubject={"reverse:" + props.entry.journalEntryId + ":" + props.date}
        amount={props.entry.lines.reduce((sum, line) => sum + line.debit.amount, 0)}
        labels={props.labels}
        onCancel={props.onCancel}
        onApproved={props.onApproved}
      />
    </Suspense>
  );
}

function ReversalError({ message }: { message: string }): ReactElement | null {
  if (message === "") return null;
  return (
    <p role="alert" className="text-danger">
      {message}
    </p>
  );
}

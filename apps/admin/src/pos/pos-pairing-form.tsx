"use client";

import { POS_PAIRING_RULES } from "@banijjik/contracts/pos";
import { Button, TextInput } from "@banijjik/ui";
import { useState, type FormEvent, type ReactElement } from "react";
import type { PosLabels } from "./pos-labels";

export interface PosPairingFormProps {
  readonly labels: PosLabels;
  readonly onPair: (pairingCode: string) => Promise<void>;
}

const DIGITS_ONLY = /^[0-9]+$/u;

/** The same shape the API checks (eight digits); the client check only saves a round trip. */
export function isPairingCodeShape(code: string): boolean {
  return code.length === POS_PAIRING_RULES.codeLength && DIGITS_ONLY.test(code);
}

export function PosPairingForm(props: PosPairingFormProps): ReactElement {
  const { labels, onPair } = props;
  const [code, setCode] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!isPairingCodeShape(code)) {
      setFailed(true);
      return;
    }
    setPending(true);
    setFailed(false);
    try {
      await onPair(code);
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
      <h1 className="text-h2 font-semibold text-primary">{labels.pairTitle}</h1>
      <p className="text-body text-secondary">{labels.pairHint}</p>
      <label className="flex flex-col gap-1 text-body font-semibold text-primary">
        {labels.pairCode}
        <TextInput
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={POS_PAIRING_RULES.codeLength}
          value={code}
          onChange={(event) => setCode(event.target.value.trim())}
          className="min-h-14 text-h3"
        />
      </label>
      {failed ? (
        <p role="alert" className="text-body text-danger">
          {labels.pairInvalid}
        </p>
      ) : null}
      <Button type="submit" isLoading={pending} className="min-h-14">
        {labels.pairSubmit}
      </Button>
    </form>
  );
}

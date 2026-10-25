"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/payment";
import { moneyFromInput } from "@banijjik/web-client";
import { Button, TextInput } from "@banijjik/ui";
import { useState, type FormEvent, type ReactElement } from "react";
import type { PosLabels } from "./pos-labels";

export interface PosOpenRegisterFormProps {
  readonly labels: PosLabels;
  readonly currency: CurrencyCode;
  /** Shown when the open is refused or fails; the terminal picks the words (session already open, or a generic failure). */
  readonly failureText: string;
  readonly onOpen: (openingFloat: Money) => Promise<void>;
}

/** Opens the register with the cash in the drawer. Zero is a valid float; an empty or unreadable one is not. */
export function PosOpenRegisterForm(props: PosOpenRegisterFormProps): ReactElement {
  const { labels, currency, failureText, onOpen } = props;
  const [floatText, setFloatText] = useState("0");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const openingFloat = moneyFromInput(floatText, currency);
    if (!openingFloat) {
      setFailed(true);
      return;
    }
    setPending(true);
    setFailed(false);
    try {
      await onOpen(openingFloat);
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
      <h1 className="text-h2 font-semibold text-primary">{labels.openTitle}</h1>
      <label className="flex flex-col gap-1 text-body font-semibold text-primary">
        {labels.openFloat}
        <TextInput
          inputMode="decimal"
          value={floatText}
          onChange={(event) => setFloatText(event.target.value.trim())}
          className="min-h-14 text-h3"
        />
      </label>
      {failed ? (
        <p role="alert" className="text-body text-danger">
          {failureText}
        </p>
      ) : null}
      <Button type="submit" isLoading={pending} className="min-h-14">
        {labels.openSubmit}
      </Button>
    </form>
  );
}

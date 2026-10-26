"use client";

import { Button, PageSection } from "@banijjik/ui";
import { useState, type FormEvent, type ReactElement } from "react";
import type { FormFailure } from "../settings/form-failure";
import { FormMessage } from "../settings/form-message";
import { SettingsTextField } from "../settings/settings-text-field";
import type { SmsSettingsLabels } from "./sms-labels";
import { sendSmsTest } from "./sms-save";
import { testResultViewOf, type TestResultView } from "./sms-test-view";

export interface SmsTestPanelProps {
  organizationId: string;
  labels: SmsSettingsLabels;
}

/** The result in words: the outcome, the failure reason, and the account that sent it. */
function ResultText(props: { view: TestResultView }): ReactElement {
  const { view } = props;
  return (
    <div role="status" className="flex flex-col gap-1 text-body text-primary">
      <p className="font-semibold">{view.outcome}</p>
      {view.failure === undefined ? null : <p className="text-small text-danger">{view.failure}</p>}
      <p className="text-small text-secondary">{view.through}</p>
    </div>
  );
}

/** The test send: one number, the saved settings, and the outcome in words. */
export function SmsTestPanel(props: SmsTestPanelProps): ReactElement {
  const { organizationId, labels } = props;
  const { test } = labels;
  const [phone, setPhone] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<TestResultView | undefined>();
  const [noAnswer, setNoAnswer] = useState(false);
  const [failure, setFailure] = useState<FormFailure | undefined>();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void sendTest();
  }

  async function sendTest(): Promise<void> {
    setIsSending(true);
    setResult(undefined);
    setNoAnswer(false);
    setFailure(undefined);
    const outcome = await sendSmsTest(organizationId, phone);
    if (outcome.kind === "answered") setResult(testResultViewOf(outcome.result, labels));
    else if (outcome.kind === "no-answer") setNoAnswer(true);
    else setFailure(outcome.failure);
    setIsSending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PageSection title={test.title} help={test.help}>
        <SettingsTextField
          fieldId="sms-test-phone"
          label={test.phone}
          value={phone}
          hint={test.phoneHint}
          inputMode="tel"
          isRequired
          errorKey={failure?.fieldErrors["phoneE164"]}
          onChange={setPhone}
        />
        <Button
          type="submit"
          isLoading={isSending}
          disabled={isSending}
          className="min-h-11 w-full"
        >
          {isSending ? test.sending : test.send}
        </Button>
      </PageSection>
      {failure === undefined ? null : <FormMessage failure={failure} />}
      {noAnswer ? (
        <p role="alert" className="text-small text-danger">
          {test.noAnswer}
        </p>
      ) : null}
      {result === undefined ? null : <ResultText view={result} />}
    </form>
  );
}

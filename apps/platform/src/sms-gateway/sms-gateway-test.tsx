"use client";

import { Button, FormField, PageSection, TextInput } from "@banijjik/ui";
import { ERROR_CODE } from "@banijjik/contracts";
import { ApiError } from "@banijjik/web-client";
import { useTranslator } from "@banijjik/web-client/client";
import { useState, type FormEvent, type ReactElement } from "react";
import { testPlatformSmsGateway, type PlatformSmsTestResult } from "./sms-gateway-api";
import type { PlatformSmsLabels } from "./sms-gateway-labels";

/** A 502 is the gateway not answering; no outcome comes back then. */
const NO_ANSWER_STATUS = 502;

interface ResultWords {
  outcome: string;
  failure: string | undefined;
}

function resultWordsOf(result: PlatformSmsTestResult, labels: PlatformSmsLabels): ResultWords {
  const reason = result.failureReason;
  return {
    outcome: labels.outcomeNames[result.outcome],
    failure: reason === null ? undefined : labels.failureNames[reason],
  };
}

function ResultText(props: { words: ResultWords }): ReactElement {
  const { words } = props;
  return (
    <div role="status" className="flex flex-col gap-1">
      <p className="text-body font-semibold text-primary">{words.outcome}</p>
      {words.failure === undefined ? null : (
        <p className="text-small text-danger">{words.failure}</p>
      )}
    </div>
  );
}

/** The platform's own test send: one number, the saved default settings, the outcome in words. */
export function PlatformSmsTestPanel(props: {
  labels: PlatformSmsLabels;
  canEdit: boolean;
}): ReactElement | null {
  const { labels, canEdit } = props;
  const { t } = useTranslator();
  const [phone, setPhone] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [words, setWords] = useState<ResultWords | undefined>();
  const [errorText, setErrorText] = useState<string | undefined>();

  if (!canEdit) return null;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void sendTest();
  }

  async function sendTest(): Promise<void> {
    setIsSending(true);
    setWords(undefined);
    setErrorText(undefined);
    try {
      const result = await testPlatformSmsGateway(phone);
      setWords(resultWordsOf(result, labels));
    } catch (error) {
      setErrorText(testErrorTextOf(error, labels, t));
    }
    setIsSending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PageSection title={labels.test.title} help={labels.test.help}>
        <FormField label={labels.test.phone} htmlFor="sms-test-phone" hint={labels.test.phoneHint}>
          <TextInput
            id="sms-test-phone"
            name="sms-test-phone"
            inputMode="tel"
            autoComplete="off"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </FormField>
        <Button
          type="submit"
          isLoading={isSending}
          disabled={isSending}
          className="min-h-11 w-full"
        >
          {isSending ? labels.test.sending : labels.test.send}
        </Button>
      </PageSection>
      {errorText === undefined ? null : (
        <p role="alert" className="text-small text-danger">
          {errorText}
        </p>
      )}
      {words === undefined ? null : <ResultText words={words} />}
    </form>
  );
}

function testErrorTextOf(
  error: unknown,
  labels: PlatformSmsLabels,
  t: (key: string) => string,
): string {
  if (!(error instanceof ApiError)) throw error;
  if (error.status === NO_ANSWER_STATUS) return labels.test.noAnswer;
  if (error.code === ERROR_CODE.VALIDATION_ERROR) return t("errors.validation_error");
  return t(error.messageKey);
}

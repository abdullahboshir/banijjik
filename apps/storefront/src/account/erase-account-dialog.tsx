"use client";

import type { Locale, Translator } from "@banijjik/i18n";
import { Button, FormField, TextInput } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { callStorefront } from "../api/client-api";
import { translatorFor } from "../i18n/client-translator";

export interface EraseAccountDialogProps {
  readonly organizationId: string;
  readonly locale: Locale;
}

interface EraseChallenge {
  readonly challengeId: string;
}

const OTP_CODE_LENGTH = 6;
const HOME_PATH = "/";

/**
 * Erasing the account needs a code sent to the customer's phone (M.6 C5, M.7 A2). The account and the
 * listing go away only after the code is accepted; the page never erases on the first click.
 */
export function EraseAccountDialog({
  organizationId,
  locale,
}: EraseAccountDialogProps): ReactElement {
  const translator = translatorFor(locale);
  const [challenge, setChallenge] = useState<EraseChallenge | undefined>(undefined);
  const [failedKey, setFailedKey] = useState<string | undefined>(undefined);
  const [isBusy, setIsBusy] = useState(false);

  async function sendCode(): Promise<void> {
    setIsBusy(true);
    setFailedKey(undefined);
    const result = await callStorefront<EraseChallenge>(
      "POST",
      `/orgs/${organizationId}/my/account/erase/otp`,
      { body: {} },
    );
    setIsBusy(false);
    if (!result.ok || result.data === undefined) return setFailedKey("storefront.error.generic");
    setChallenge(result.data);
  }

  if (challenge === undefined) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-body text-secondary">{translator.t("storefront.account.eraseIntro")}</p>
        <Button variant="danger" isLoading={isBusy} onClick={() => void sendCode()}>
          {translator.t("storefront.account.eraseSendCode")}
        </Button>
        {failedKey ? <ErrorLine text={translator.t(failedKey)} /> : null}
      </div>
    );
  }
  return (
    <EraseConfirmForm
      organizationId={organizationId}
      challengeId={challenge.challengeId}
      translator={translator}
    />
  );
}

/** The code step: the account is erased only when the API accepts the challenge and the code. */
function EraseConfirmForm({
  organizationId,
  challengeId,
  translator,
}: {
  readonly organizationId: string;
  readonly challengeId: string;
  readonly translator: Translator;
}): ReactElement {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [failedKey, setFailedKey] = useState<string | undefined>(undefined);
  const [isBusy, setIsBusy] = useState(false);

  async function erase(): Promise<void> {
    setIsBusy(true);
    setFailedKey(undefined);
    const result = await callStorefront("POST", `/orgs/${organizationId}/my/account/erase`, {
      body: { challengeId, code },
    });
    setIsBusy(false);
    if (!result.ok) return setFailedKey("storefront.error.invalidCode");
    router.push(HOME_PATH);
  }

  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void erase();
      }}
    >
      <FormField
        label={translator.t("storefront.account.eraseCodeLabel")}
        htmlFor="erase-code"
        required
      >
        <TextInput
          id="erase-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={OTP_CODE_LENGTH}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      </FormField>
      {failedKey ? <ErrorLine text={translator.t(failedKey)} /> : null}
      <Button type="submit" variant="danger" isLoading={isBusy}>
        {translator.t("storefront.account.eraseConfirm")}
      </Button>
    </form>
  );
}

function ErrorLine({ text }: { readonly text: string }): ReactElement {
  return (
    <p role="alert" className="text-small text-danger">
      {text}
    </p>
  );
}

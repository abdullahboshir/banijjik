"use client";

import type { Locale, Translator } from "@banijjik/i18n";
import { Button, FormField, TextInput } from "@banijjik/ui";
import { useState, type FormEvent, type ReactElement } from "react";
import { translatorFor } from "../i18n/client-translator";

export interface SignInFormProps {
  readonly organizationId: string;
  readonly locale: Locale;
  /** Where to go after the sign-in; already checked on the server (safeNextPath). */
  readonly nextPath: string;
}

type Step = "phone" | "code";

const API_PREFIX = "/api/v1/storefront";
const SECONDS_PER_MINUTE = 60;
const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_TOO_MANY = 429;

/** The text key for a failed call, by what the API answered. */
function failureKey(step: Step, status: number): string {
  if (status === HTTP_NOT_FOUND) return "storefront.signIn.notOpen";
  if (status === HTTP_TOO_MANY) return "storefront.error.rateLimited";
  if (status === HTTP_FORBIDDEN) return "storefront.error.blocked";
  if (status === HTTP_BAD_REQUEST) {
    return step === "phone" ? "storefront.error.invalidPhone" : "storefront.error.invalidCode";
  }
  return "storefront.error.generic";
}

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(`${API_PREFIX}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
}

interface StepProps {
  readonly translator: Translator["t"];
}

interface PhoneStepProps extends StepProps {
  readonly phone: string;
  readonly onPhoneChange: (value: string) => void;
}

interface CodeStepProps extends StepProps {
  readonly code: string;
  readonly minutes: number;
  readonly onCodeChange: (value: string) => void;
}

function PhoneStep({ translator, phone, onPhoneChange }: PhoneStepProps): ReactElement {
  return (
    <FormField
      label={translator("storefront.signIn.phoneLabel")}
      htmlFor="sign-in-phone"
      hint={translator("storefront.signIn.phoneHint")}
      required
    >
      <TextInput
        id="sign-in-phone"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        value={phone}
        onChange={(event) => onPhoneChange(event.target.value)}
      />
    </FormField>
  );
}

function CodeStep({ translator, code, minutes, onCodeChange }: CodeStepProps): ReactElement {
  const hint = `${translator("storefront.signIn.codeHint")} ${translator("storefront.signIn.codeSent", { minutes })}`;
  return (
    <FormField
      label={translator("storefront.signIn.codeLabel")}
      htmlFor="sign-in-code"
      hint={hint}
      required
    >
      <TextInput
        id="sign-in-code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        value={code}
        onChange={(event) => onCodeChange(event.target.value)}
      />
    </FormField>
  );
}

/** Phone, then the one-time code. Success reloads the page at `nextPath` with the cookies set. */
export function SignInForm({ organizationId, locale, nextPath }: SignInFormProps): ReactElement {
  const translator = translatorFor(locale).t;
  const state = useSignInState(organizationId, nextPath);
  return (
    <form
      onSubmit={(event) => void state.submit(event)}
      className="flex max-w-md flex-col gap-4"
      noValidate
    >
      {state.errorKey ? (
        <p role="alert" className="rounded-md border border-danger p-3 text-body text-danger">
          {translator(state.errorKey)}
        </p>
      ) : null}
      {state.step === "phone" ? (
        <PhoneStep translator={translator} phone={state.phone} onPhoneChange={state.setPhone} />
      ) : (
        <CodeStep
          translator={translator}
          code={state.code}
          minutes={state.minutes}
          onCodeChange={state.setCode}
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" isLoading={state.isBusy}>
          {translator(
            state.step === "phone" ? "storefront.signIn.sendCode" : "storefront.signIn.verify",
          )}
        </Button>
        {state.step === "code" ? (
          <Button variant="ghost" onClick={state.backToPhone}>
            {translator("storefront.signIn.changeNumber")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

interface SignInState {
  readonly step: Step;
  readonly phone: string;
  readonly code: string;
  readonly minutes: number;
  readonly errorKey: string | undefined;
  readonly isBusy: boolean;
  readonly setPhone: (value: string) => void;
  readonly setCode: (value: string) => void;
  readonly backToPhone: () => void;
  readonly submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

/** The form's state and its two calls: send the code, then verify it. */
function useSignInState(organizationId: string, nextPath: string): SignInState {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [minutes, setMinutes] = useState(0);
  const [errorKey, setErrorKey] = useState<string | undefined>(undefined);
  const [isBusy, setIsBusy] = useState(false);

  async function sendCode(): Promise<void> {
    const response = await postJson(`/orgs/${organizationId}/auth/otp/send`, { phone });
    if (!response.ok) return setErrorKey(failureKey("phone", response.status));
    const envelope = (await response.json()) as { data: { expiresInSeconds: number } };
    setMinutes(Math.round(envelope.data.expiresInSeconds / SECONDS_PER_MINUTE));
    setStep("code");
  }

  async function verifyCode(): Promise<void> {
    const response = await postJson(`/orgs/${organizationId}/auth/otp/verify`, { phone, code });
    if (!response.ok) return setErrorKey(failureKey("code", response.status));
    window.location.assign(nextPath);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorKey(undefined);
    setIsBusy(true);
    try {
      if (step === "phone") await sendCode();
      else await verifyCode();
    } catch {
      setErrorKey("storefront.error.generic");
    } finally {
      setIsBusy(false);
    }
  }

  return {
    step,
    phone,
    code,
    minutes,
    errorKey,
    isBusy,
    setPhone,
    setCode,
    backToPhone: () => setStep("phone"),
    submit,
  };
}

"use client";

import { useTranslator } from "@banijjik/web-client/client";
import { Button } from "@banijjik/ui";
import { safeNextPath } from "@banijjik/web-client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactElement } from "react";
import { login } from "../api/platform-api";
import { issuesToFieldErrors, type FieldErrors } from "../forms/schema-errors";
import { TextFieldRow } from "../forms/text-field-row";
import { useFormSubmit } from "../forms/use-form-submit";

const INITIAL_VALUES = { identifier: "", password: "" };

/** The schema library loads on the first submit, so it is not part of the first load of the page. */
async function validate(values: typeof INITIAL_VALUES): Promise<FieldErrors> {
  const { loginRequestSchema } = await import("@banijjik/validation");
  const result = loginRequestSchema.safeParse(values);
  return result.success ? {} : issuesToFieldErrors(result.error.issues, values);
}

/** Operator sign-in: identifier and password to `POST /platform/auth/login`. A business account is refused there. */
export function SignInForm({ nextPath }: { nextPath: string }): ReactElement {
  const { t } = useTranslator();
  const router = useRouter();
  const submit = useFormSubmit();
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const found = await validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (await submit.run(() => login(values))) router.replace(safeNextPath(nextPath));
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate className="flex flex-col gap-4">
      <TextFieldRow
        fieldId="identifier"
        label={t("auth.field.identifier")}
        autoComplete="username"
        value={values.identifier}
        errorKey={errors["identifier"]}
        onChange={(identifier) => setValues({ ...values, identifier })}
      />
      <TextFieldRow
        fieldId="password"
        label={t("auth.field.password")}
        type="password"
        autoComplete="current-password"
        value={values.password}
        errorKey={errors["password"]}
        onChange={(password) => setValues({ ...values, password })}
      />
      {submit.failure ? (
        <p role="alert" className="text-small text-danger">
          {t(submit.failure.messageKey, submit.failure.values)}
        </p>
      ) : null}
      <Button type="submit" isLoading={submit.isSubmitting}>
        {t("auth.signIn.submit")}
      </Button>
    </form>
  );
}

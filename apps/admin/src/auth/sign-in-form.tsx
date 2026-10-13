"use client";

import { useTranslator } from "@banijjik/web-client/client";
import { loginRequestSchema } from "@banijjik/validation";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { login } from "../lib/api/auth-api";
import { AuthTextField } from "./auth-text-field";
import { issuesToFieldErrors, type FieldErrors } from "./field-errors";
import { FormFooter } from "./form-footer";
import { PasswordField } from "./password-field";
import { safeNextPath } from "./safe-next-path";
import { useAuthForm } from "./use-auth-form";

interface SignInValues extends Record<string, string> {
  identifier: string;
  password: string;
}

const INITIAL_VALUES: SignInValues = { identifier: "", password: "" };

function validateSignIn(values: SignInValues): FieldErrors {
  const result = loginRequestSchema.safeParse(values);
  return result.success ? {} : issuesToFieldErrors(result.error.issues, values);
}

export function SignInForm({ nextPath }: { nextPath: string }): ReactElement {
  const { t } = useTranslator();
  const router = useRouter();
  const form = useAuthForm<SignInValues>({
    initialValues: INITIAL_VALUES,
    validate: validateSignIn,
    submit: async (values) => {
      await login(values);
      router.replace(safeNextPath(nextPath));
    },
  });
  return (
    <form onSubmit={form.handleSubmit} noValidate className="flex flex-col gap-4">
      <AuthTextField
        fieldId="identifier"
        label={t("auth.field.identifier")}
        hint={t("auth.field.identifierHint")}
        value={form.values.identifier}
        error={form.fieldErrors.identifier}
        autoComplete="username"
        isIdentifier
        onChange={(value) => form.setValue("identifier", value)}
        onBlur={() => form.validateField("identifier")}
      />
      <PasswordField
        fieldId="password"
        label={t("auth.field.password")}
        value={form.values.password}
        error={form.fieldErrors.password}
        autoComplete="current-password"
        onChange={(value) => form.setValue("password", value)}
        onBlur={() => form.validateField("password")}
      />
      <FormFooter
        formError={form.formError}
        isSubmitting={form.isSubmitting}
        submitLabel={t("auth.signIn.submit")}
      />
    </form>
  );
}

"use client";

import type { UserRegisterRequest } from "@banijjik/contracts";
import type { Locale } from "@banijjik/i18n";
import { userRegisterRequestSchema } from "@banijjik/validation";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { register } from "../lib/api/auth-api";
import { useTranslator } from "../lib/i18n/i18n-provider";
import { AuthTextField } from "./auth-text-field";
import { issuesToFieldErrors, type FieldErrors } from "./field-errors";
import { FormFooter } from "./form-footer";
import { PasswordField } from "./password-field";
import { safeNextPath } from "./safe-next-path";
import { useAuthForm } from "./use-auth-form";

interface SignUpValues extends Record<string, string> {
  name: string;
  identifier: string;
  password: string;
}

const INITIAL_VALUES: SignUpValues = { name: "", identifier: "", password: "" };

/** One field takes a phone number or an email; an `@` means email, as at sign-in. */
function buildRegisterBody(values: SignUpValues, locale: Locale): UserRegisterRequest {
  const identifier = values.identifier.trim();
  const base = { name: values.name, password: values.password, preferredLocale: locale };
  return identifier.includes("@") ? { ...base, email: identifier } : { ...base, phone: identifier };
}

function validateSignUp(values: SignUpValues, locale: Locale): FieldErrors {
  const result = userRegisterRequestSchema.safeParse(buildRegisterBody(values, locale));
  const fieldErrors = result.success ? {} : issuesToFieldErrors(result.error.issues, values);
  // The password rules belong to the API (iam domain); the form only insists that something was typed.
  if (values.password === "") return { ...fieldErrors, password: "validation.required" };
  return fieldErrors;
}

export function SignUpForm({ nextPath }: { nextPath: string }): ReactElement {
  const { t, locale } = useTranslator();
  const router = useRouter();
  const form = useAuthForm<SignUpValues>({
    initialValues: INITIAL_VALUES,
    validate: (values) => validateSignUp(values, locale),
    submit: async (values) => {
      await register(buildRegisterBody(values, locale));
      router.replace(safeNextPath(nextPath));
    },
  });
  return (
    <form onSubmit={form.handleSubmit} noValidate className="flex flex-col gap-4">
      <AuthTextField
        fieldId="name"
        label={t("auth.field.name")}
        value={form.values.name}
        error={form.fieldErrors.name}
        autoComplete="name"
        onChange={(value) => form.setValue("name", value)}
        onBlur={() => form.validateField("name")}
      />
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
        autoComplete="new-password"
        onChange={(value) => form.setValue("password", value)}
        onBlur={() => form.validateField("password")}
      />
      <FormFooter
        formError={form.formError}
        isSubmitting={form.isSubmitting}
        submitLabel={t("auth.signUp.submit")}
      />
    </form>
  );
}

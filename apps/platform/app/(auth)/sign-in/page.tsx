import { PageLayout } from "@banijjik/ui";
import { SESSION_UNAVAILABLE_REASON, safeNextPath } from "@banijjik/web-client";
import type { ReactElement } from "react";
import { SignInForm } from "../../../src/auth/sign-in-form";
import { getTranslator } from "../../../src/i18n/get-translator";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}): Promise<ReactElement> {
  const { next, reason } = await searchParams;
  const { t } = await getTranslator();
  return (
    <PageLayout title={t("platform.signIn.title")}>
      {reason === SESSION_UNAVAILABLE_REASON ? (
        <p role="alert" className="text-small text-danger">
          {t("auth.session_unavailable")}
        </p>
      ) : null}
      <SignInForm nextPath={safeNextPath(next)} />
    </PageLayout>
  );
}

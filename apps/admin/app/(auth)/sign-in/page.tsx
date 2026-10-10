import { PageHeader } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { SESSION_UNAVAILABLE_REASON, safeNextPath } from "../../../src/auth/safe-next-path";
import { SignInForm } from "../../../src/auth/sign-in-form";
import { getTranslator } from "../../../src/lib/i18n/get-translator";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}): Promise<ReactElement> {
  const { next, reason } = await searchParams;
  const nextPath = safeNextPath(next);
  const { t } = await getTranslator();
  return (
    <>
      <PageHeader title={t("auth.signIn.title")} />
      {reason === SESSION_UNAVAILABLE_REASON ? (
        <p role="alert" className="text-small text-danger">
          {t("auth.session_unavailable")}
        </p>
      ) : null}
      <SignInForm nextPath={nextPath} />
      <p className="text-body text-secondary">
        {t("auth.signIn.prompt")}{" "}
        <Link
          href={`/sign-up?next=${encodeURIComponent(nextPath)}`}
          className="inline-flex min-h-11 items-center font-semibold text-brand"
        >
          {t("auth.signIn.toSignUp")}
        </Link>
      </p>
    </>
  );
}

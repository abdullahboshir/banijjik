import { PageLayout } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { safeNextPath } from "../../../src/auth/safe-next-path";
import { SignUpForm } from "../../../src/auth/sign-up-form";
import { getTranslator } from "../../../src/lib/i18n/get-translator";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}): Promise<ReactElement> {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  const { t } = await getTranslator();
  return (
    <PageLayout title={t("auth.signUp.title")}>
      <SignUpForm nextPath={nextPath} />
      <p className="text-body text-secondary">
        {t("auth.signUp.prompt")}{" "}
        <Link
          href={`/sign-in?next=${encodeURIComponent(nextPath)}`}
          className="inline-flex min-h-11 items-center font-semibold text-brand"
        >
          {t("auth.signUp.toSignIn")}
        </Link>
      </p>
    </PageLayout>
  );
}

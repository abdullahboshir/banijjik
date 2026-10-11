"use client";

import { Button, EmptyState } from "@banijjik/ui";
import type { ReactElement } from "react";
import { useTranslator } from "../../../src/lib/i18n/i18n-provider";

/** A failed page inside a business keeps the shell around it; the person can try again. */
export default function OrganizationPageError({
  reset,
}: {
  error: Error;
  reset: () => void;
}): ReactElement {
  const { t } = useTranslator();
  return (
    <EmptyState
      message={t("errors.internal")}
      action={<Button onClick={reset}>{t("common.retry")}</Button>}
    />
  );
}

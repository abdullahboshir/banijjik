"use client";

import { useTranslator } from "@banijjik/web-client/client";
import { Button, EmptyState } from "@banijjik/ui";
import type { ReactElement } from "react";

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

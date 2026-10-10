"use client";

import { Button, EmptyState } from "@banijjik/ui";
import type { ReactElement } from "react";
import { useTranslator } from "../src/lib/i18n/i18n-provider";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }): ReactElement {
  const { t } = useTranslator();
  return (
    <main className="p-4">
      <EmptyState
        message={t("errors.internal")}
        action={<Button onClick={reset}>{t("common.retry")}</Button>}
      />
    </main>
  );
}

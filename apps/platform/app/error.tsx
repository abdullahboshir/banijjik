"use client";

import { useTranslator } from "@banijjik/web-client/client";
import { Button, EmptyState } from "@banijjik/ui";
import type { ReactElement } from "react";

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

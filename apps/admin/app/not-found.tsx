import { EmptyState } from "@banijjik/ui";
import type { ReactElement } from "react";
import { getTranslator } from "../src/lib/i18n/get-translator";

export default async function NotFoundPage(): Promise<ReactElement> {
  const { t } = await getTranslator();
  return (
    <main className="p-4">
      <EmptyState message={t("errors.not_found")} />
    </main>
  );
}

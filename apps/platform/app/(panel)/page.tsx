import { EmptyState } from "@banijjik/ui";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import { loadOperator } from "../../src/auth/session-data";
import { getTranslator } from "../../src/i18n/get-translator";
import { navigationEntriesFor } from "../../src/shell/navigation-entries";

/** The panel has no dashboard yet: the operator lands on the first page their permissions allow. */
export default async function PanelHomePage(): Promise<ReactElement> {
  const [operator, { t }] = await Promise.all([loadOperator(), getTranslator()]);
  const [firstEntry] = navigationEntriesFor(operator, t);
  if (firstEntry) redirect(firstEntry.href);
  return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
}

import { EmptyState, PageHeader } from "@banijjik/ui";
import type { ReactElement } from "react";
import { getTranslator } from "../../../src/lib/i18n/get-translator";

export default async function OrganizationHomePage(): Promise<ReactElement> {
  const { t } = await getTranslator();
  return (
    <>
      <PageHeader title={t("home.title")} />
      <EmptyState message={t("home.empty")} />
    </>
  );
}

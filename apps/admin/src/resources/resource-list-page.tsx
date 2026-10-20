import { PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";

export async function ResourceListPage(props: {
  readonly orgSlug: string;
  readonly searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  void props.searchParams;
  await requireOrgAccess(props.orgSlug);
  const { t } = await getTranslator();
  return (
    <PageLayout title={t("menu.booking.resources")} subtitle={t("resources.list.subtitle")}>
      <p>{t("resources.list.placeholder")}</p>
    </PageLayout>
  );
}

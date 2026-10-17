import { DashboardFrame } from "@banijjik/ui";
import type { ReactElement } from "react";
import { getTranslator } from "../../../src/lib/i18n/get-translator";
import { requireOrgAccess } from "../../../src/shell/org-access";

/** The business home: the greeting and the area where the "today" cards of card 3.10 will appear. */
export default async function OrganizationHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  const [{ t }, { me }] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  return (
    <DashboardFrame greeting={t("home.greeting", { name: me.name })} subtitle={t("home.ready")} />
  );
}

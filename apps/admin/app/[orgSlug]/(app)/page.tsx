import { EmptyState, PageHeader } from "@banijjik/ui";
import type { ReactElement } from "react";
import { getTranslator } from "../../../src/lib/i18n/get-translator";
import { requireOrgAccess } from "../../../src/shell/org-access";

export default async function OrganizationHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  const [{ t }, { organization }] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  return (
    <>
      <PageHeader title={organization.name} />
      <EmptyState message={t("home.ready")} />
    </>
  );
}

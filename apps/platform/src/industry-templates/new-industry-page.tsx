import { PLATFORM_PERMISSION_KEY, type PlatformIndustryTemplateSummary } from "@banijjik/contracts";
import { EmptyState, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fetchPlatformResource } from "../api/platform-resource";
import { holdsPermission } from "../auth/permissions";
import { loadOperator } from "../auth/session-data";
import { getTranslator } from "../i18n/get-translator";
import { buildIndustryLabels } from "./industry-labels";
import { NewIndustryForm } from "./new-industry-form";

/** `/industry-templates/new`: a draft from nothing, or a copy of an existing template. */
export async function NewIndustryPage(): Promise<ReactElement> {
  const [operator, translator] = await Promise.all([loadOperator(), getTranslator()]);
  const { t, locale } = translator;
  if (!holdsPermission(operator, PLATFORM_PERMISSION_KEY.INDUSTRY_WRITE)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const templates = await fetchPlatformResource<PlatformIndustryTemplateSummary[]>(
    "/platform/industry-templates?limit=100",
  );
  return (
    <PageLayout
      title={t("platform.industries.new")}
      subtitle={t("platform.industries.new.subtitle")}
    >
      <NewIndustryForm templates={templates.data} labels={buildIndustryLabels(t)} locale={locale} />
    </PageLayout>
  );
}

import {
  PLATFORM_PERMISSION_KEY,
  type PlatformIndustryTemplateDetail,
  type PlatformSettingDefinition,
} from "@banijjik/contracts";
import { DetailHeader, EmptyState } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fetchPlatformResource } from "../api/platform-resource";
import { holdsPermission } from "../auth/permissions";
import { loadOperator } from "../auth/session-data";
import { getTranslator } from "../i18n/get-translator";
import { StatusPill } from "../shell/status-pill";
import { buildIndustryLabels } from "./industry-labels";
import { IndustryTemplateEditor } from "./industry-template-editor";

/** `/industry-templates/{industryTemplateId}`: configure one industry and publish it. */
export async function IndustryTemplateEditorPage({
  industryTemplateId,
}: {
  industryTemplateId: string;
}): Promise<ReactElement> {
  const [operator, translator] = await Promise.all([loadOperator(), getTranslator()]);
  const { t, locale } = translator;
  if (!holdsPermission(operator, PLATFORM_PERMISSION_KEY.INDUSTRY_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const [template, definitions] = await Promise.all([
    fetchPlatformResource<PlatformIndustryTemplateDetail>(
      `/platform/industry-templates/${industryTemplateId}`,
    ),
    fetchPlatformResource<PlatformSettingDefinition[]>("/platform/setting-definitions"),
  ]);
  const detail = template.data;
  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        title={detail.name[locale]}
        backHref="/industry-templates"
        backLabel={t("platform.industries.title")}
        status={
          <StatusPill
            tone={detail.status === "PUBLISHED" ? "success" : "neutral"}
            label={t(`platform.status.industryTemplate.${detail.status}`)}
          />
        }
      />
      <IndustryTemplateEditor
        key={detail.version}
        template={detail}
        definitions={definitions.data}
        canWrite={holdsPermission(operator, PLATFORM_PERMISSION_KEY.INDUSTRY_WRITE)}
        labels={buildIndustryLabels(t)}
        locale={locale}
      />
    </div>
  );
}

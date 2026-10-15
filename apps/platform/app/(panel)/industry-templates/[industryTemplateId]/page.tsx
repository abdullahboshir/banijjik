import type { ReactElement } from "react";
import { IndustryTemplateEditorPage } from "../../../../src/industry-templates/industry-template-editor-page";

export default async function IndustryTemplateRoute({
  params,
}: {
  params: Promise<{ industryTemplateId: string }>;
}): Promise<ReactElement> {
  const { industryTemplateId } = await params;
  return <IndustryTemplateEditorPage industryTemplateId={industryTemplateId} />;
}

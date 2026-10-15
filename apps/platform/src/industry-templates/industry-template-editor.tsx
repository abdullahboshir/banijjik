"use client";

import type {
  PlatformIndustryTemplateDetail,
  PlatformSettingDefinition,
} from "@banijjik/contracts";
import { Button } from "@banijjik/ui";
import type { ReactElement } from "react";
import { useEditorActions } from "./editor-actions";
import { EditorSections } from "./editor-sections";
import { labelsTranslator, type IndustryLabels } from "./industry-labels";
import { templateRefusesRemoval, templateStatusActions } from "./template-status";

export function IndustryTemplateEditor({
  template,
  definitions,
  canWrite,
  labels,
  locale,
}: {
  template: PlatformIndustryTemplateDetail;
  definitions: readonly PlatformSettingDefinition[];
  canWrite: boolean;
  labels: IndustryLabels;
  locale: "bn" | "en";
}): ReactElement {
  const t = labelsTranslator(labels);
  const refusesRemoval = templateRefusesRemoval(template.status);
  const actions = templateStatusActions(template.status, canWrite);
  const { savePatch, saveStatus, sheet } = useEditorActions(template, labels);
  return (
    <div className="flex flex-col gap-3">
      {refusesRemoval ? (
        <p role="status" className="text-small text-secondary">
          {t(`platform.industry.locked.${template.status}`)}
        </p>
      ) : null}
      {!canWrite ? (
        <p className="text-small text-secondary">{t("platform.industry.readOnly")}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action}
            id={action === "publish" ? "publish-template" : "retire-template"}
            variant={action === "retire" ? "danger" : "primary"}
            onClick={() => saveStatus(action)}
          >
            {t(`platform.industry.action.${action}`)}
          </Button>
        ))}
      </div>
      <EditorSections
        template={template}
        definitions={definitions}
        canWrite={canWrite}
        refusesRemoval={refusesRemoval}
        labels={labels}
        locale={locale}
        onSave={savePatch}
      />
      {sheet}
    </div>
  );
}

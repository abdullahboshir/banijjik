"use client";

import type {
  PlatformIndustryTemplateDetail,
  PlatformSettingDefinition,
} from "@banijjik/contracts";
import { Button } from "@banijjik/ui";
import { useLazyComponent } from "@banijjik/web-client/client";
import { type ComponentType, type ReactElement } from "react";
import { useEditorActions } from "./editor-actions";
import type { EditorSectionsProps } from "./editor-sections";
import { labelsTranslator, type IndustryLabels } from "./industry-labels";
import {
  templateLockMessageKey,
  templateRefusesRemoval,
  templateStatusActions,
} from "./template-status";

async function loadSections(): Promise<ComponentType<EditorSectionsProps>> {
  const loaded = await import("./editor-sections");
  return loaded.EditorSections;
}

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
  const refusesRemoval = templateRefusesRemoval(template);
  const lockMessageKey = templateLockMessageKey(template);
  const actions = templateStatusActions(template.status, canWrite);
  const { savePatch, saveStatus, sheet } = useEditorActions(template, labels);
  const Sections = useLazyComponent(loadSections, true);
  return (
    <div className="flex flex-col gap-3">
      {lockMessageKey === undefined ? null : (
        <p role="status" className="text-small text-secondary">
          {t(lockMessageKey)}
        </p>
      )}
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
      {Sections === null ? null : (
        <Sections
          template={template}
          definitions={definitions}
          canWrite={canWrite}
          refusesRemoval={refusesRemoval}
          labels={labels}
          locale={locale}
          onSave={savePatch}
        />
      )}
      {sheet}
    </div>
  );
}

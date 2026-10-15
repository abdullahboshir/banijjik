"use client";

import type { PlatformIndustryTemplateDetail } from "@banijjik/contracts";
import type { ReactElement } from "react";
import { setIndustryTemplateStatus, updateIndustryTemplate } from "../api/platform-api";
import { labelsTranslator, type IndustryLabels } from "./industry-labels";
import { useTemplateSave, type TemplatePatch } from "./use-template-save";

/** Section saves and publish/retire, each one opening the same reason sheet. */
export function useEditorActions(
  template: PlatformIndustryTemplateDetail,
  labels: IndustryLabels,
): {
  savePatch: (patch: TemplatePatch) => void;
  saveStatus: (action: "publish" | "retire") => void;
  sheet: ReactElement | null;
} {
  const t = labelsTranslator(labels);
  const { requestSave, sheet } = useTemplateSave(labels, (reason, patch) =>
    updateIndustryTemplate(template.industryTemplateId, {
      version: template.version,
      reason,
      ...patch,
    }),
  );

  function savePatch(patch: TemplatePatch): void {
    requestSave({
      title: t("platform.industry.action.save"),
      submitLabel: t("platform.industry.action.save"),
      successMessage: t("platform.industry.saved"),
      patch,
    });
  }

  function saveStatus(action: "publish" | "retire"): void {
    requestSave({
      title: t(`platform.industry.action.${action}`),
      submitLabel: t(`platform.industry.action.${action}`),
      successMessage: t("platform.industry.saved"),
      save: (reason) =>
        setIndustryTemplateStatus(template.industryTemplateId, action, {
          version: template.version,
          reason,
        }),
    });
  }

  return { savePatch, saveStatus, sheet };
}

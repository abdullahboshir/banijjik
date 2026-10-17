"use client";

import {
  MODULE_CLASS,
  MODULE_KEY_VALUES,
  OFFERING_KIND,
  type ModuleClass,
  type ModuleKey,
  type OfferingKind,
} from "@banijjik/contracts";
import { Button, Checkbox } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { moduleClassLabelKey, moduleLabelKey } from "../packages/module-catalog";
import { ModulePicker } from "../packages/module-picker";
import { IndustrySection } from "./industry-section";
import { labelsTranslator, type IndustryLabels } from "./industry-labels";
import type { TemplatePatch } from "./use-template-save";

const KINDS = Object.values(OFFERING_KIND);

function toggleKind(
  selected: OfferingKind[],
  kind: OfferingKind,
  checked: boolean,
): OfferingKind[] {
  if (checked) return selected.includes(kind) ? selected : [...selected, kind];
  return selected.filter((item) => item !== kind);
}

function labelsForModules(t: (key: string) => string): Record<ModuleKey, string> {
  // Safe: the object is built from every module key.
  return Object.fromEntries(
    MODULE_KEY_VALUES.map((moduleKey) => [moduleKey, t(moduleLabelKey(moduleKey))]),
  ) as Record<ModuleKey, string>;
}

function labelsForClasses(t: (key: string) => string): Record<ModuleClass, string> {
  // Safe: the object is built from every module class.
  return Object.fromEntries(
    Object.values(MODULE_CLASS).map((moduleClass) => [
      moduleClass,
      t(moduleClassLabelKey(moduleClass)),
    ]),
  ) as Record<ModuleClass, string>;
}

export function KindsSection({
  enabledKinds,
  allowedModuleKeys,
  canWrite,
  refusesRemoval,
  labels,
  onSave,
}: {
  enabledKinds: readonly OfferingKind[];
  allowedModuleKeys: readonly ModuleKey[];
  canWrite: boolean;
  refusesRemoval: boolean;
  labels: IndustryLabels;
  onSave: (patch: TemplatePatch) => void;
}): ReactElement {
  const t = labelsTranslator(labels);
  const [kinds, setKinds] = useState<OfferingKind[]>([...enabledKinds]);
  const [modules, setModules] = useState<ModuleKey[]>([...allowedModuleKeys]);
  return (
    <IndustrySection
      title={t("platform.industry.section.kinds")}
      help={t("platform.industry.section.kinds.help")}
    >
      <div className="grid gap-x-4 sm:grid-cols-2">
        {KINDS.map((kind) => (
          <Checkbox
            key={kind}
            label={t(`platform.kind.${kind}`)}
            checked={kinds.includes(kind)}
            disabled={!canWrite || (refusesRemoval && enabledKinds.includes(kind))}
            onChange={(event) => setKinds(toggleKind(kinds, kind, event.target.checked))}
          />
        ))}
      </div>
      <ModulePicker
        legend={t("platform.industry.section.modules")}
        selected={modules}
        moduleLabels={labelsForModules(t)}
        classLabels={labelsForClasses(t)}
        isReadOnly={!canWrite}
        onChange={setModules}
      />
      {canWrite ? (
        <Button
          id="save-kinds"
          onClick={() => onSave({ enabledKinds: kinds, allowedModuleKeys: modules })}
        >
          {t("platform.industry.action.save")}
        </Button>
      ) : null}
    </IndustrySection>
  );
}

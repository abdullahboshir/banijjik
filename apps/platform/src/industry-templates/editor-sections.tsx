"use client";

import type {
  PlatformIndustryTemplateDetail,
  PlatformSettingDefinition,
} from "@banijjik/contracts";
import type { ReactElement } from "react";
import { BasicsSection } from "./basics-section";
import { BotSection } from "./bot-section";
import { FieldsSection } from "./fields-section";
import type { IndustryLabels } from "./industry-labels";
import { KindsSection } from "./kinds-section";
import { RolesSection } from "./roles-section";
import { SettingsSection } from "./settings-section";
import { TermsSection } from "./terms-section";
import type { TemplatePatch } from "./use-template-save";

interface SectionProps {
  template: PlatformIndustryTemplateDetail;
  definitions: readonly PlatformSettingDefinition[];
  canWrite: boolean;
  refusesRemoval: boolean;
  labels: IndustryLabels;
  locale: "bn" | "en";
  onSave: (patch: TemplatePatch) => void;
}

/** The collapsible sections of one template. Each one saves through the same reason sheet. */
export function EditorSections(props: SectionProps): ReactElement {
  return (
    <>
      <CatalogSections {...props} />
      <OperationsSections {...props} />
    </>
  );
}

function CatalogSections(props: SectionProps): ReactElement {
  const { template, canWrite, refusesRemoval, labels, onSave } = props;
  return (
    <>
      <BasicsSection
        name={template.name}
        description={template.description}
        iconKey={template.iconKey}
        canWrite={canWrite}
        labels={labels}
        onSave={onSave}
      />
      <KindsSection
        enabledKinds={template.enabledKinds}
        allowedModuleKeys={template.allowedModuleKeys}
        canWrite={canWrite}
        refusesRemoval={refusesRemoval}
        labels={labels}
        onSave={onSave}
      />
      <TermsSection
        configuration={template.configuration}
        canWrite={canWrite}
        refusesRemoval={refusesRemoval}
        labels={labels}
        onSave={onSave}
      />
    </>
  );
}

function OperationsSections(props: SectionProps): ReactElement {
  const { template, canWrite, labels, onSave } = props;
  return (
    <>
      <FieldsSection
        configuration={template.configuration}
        locale={props.locale}
        canWrite={canWrite}
        refusesRemoval={props.refusesRemoval}
        labels={labels}
        onSave={onSave}
      />
      <SettingsSection
        configuration={template.configuration}
        definitions={props.definitions}
        canWrite={canWrite}
        labels={labels}
        onSave={onSave}
      />
      <RolesSection
        configuration={template.configuration}
        canWrite={canWrite}
        refusesRemoval={props.refusesRemoval}
        labels={labels}
        onSave={onSave}
      />
      <BotSection
        configuration={template.configuration}
        canWrite={canWrite}
        labels={labels}
        onSave={onSave}
      />
    </>
  );
}

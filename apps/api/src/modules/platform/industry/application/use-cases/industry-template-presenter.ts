import type {
  IndustryTemplateCard,
  PlatformIndustryTemplateDetail,
  PlatformIndustryTemplateSummary,
} from "@banijjik/contracts";
import type { IndustryTemplate } from "../../domain/industry-template.entity.js";
import type { OrganizationTemplateUsage } from "./industry-template-write-dependencies.js";
import { pendingSettingKeysOf, type SettingCatalog } from "../registered-settings.js";

export function toIndustryTemplateCard(template: IndustryTemplate): IndustryTemplateCard {
  return {
    industryTemplateKey: template.industryTemplateKey,
    name: template.name,
    description: template.description,
    iconKey: template.iconKey,
  };
}

export function toIndustryTemplateSummary(
  template: IndustryTemplate,
): PlatformIndustryTemplateSummary {
  return {
    industryTemplateId: template.industryTemplateId,
    industryTemplateKey: template.industryTemplateKey,
    status: template.status,
    name: template.name,
    iconKey: template.iconKey,
    enabledKinds: template.enabledKinds,
    allowedModuleKeys: template.allowedModuleKeys,
    version: template.version,
    updatedAt: template.updatedAt.toISOString(),
  };
}

/** Whether any organization already uses the template's key. */
export async function isTemplateInUse(
  usage: OrganizationTemplateUsage,
  template: IndustryTemplate,
): Promise<boolean> {
  return (await usage.countByTemplateKey(template.industryTemplateKey)) > 0;
}

export function toIndustryTemplateDetail(
  template: IndustryTemplate,
  settings: SettingCatalog,
  isInUse: boolean,
): PlatformIndustryTemplateDetail {
  return {
    ...toIndustryTemplateSummary(template),
    description: template.description,
    configuration: template.configuration,
    createdAt: template.createdAt.toISOString(),
    pendingSettingKeys: pendingSettingKeysOf(template.configuration.settingsDefaults, settings),
    isInUse,
  };
}

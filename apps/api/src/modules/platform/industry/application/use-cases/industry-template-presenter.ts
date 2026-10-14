import type {
  IndustryTemplateCard,
  PlatformIndustryTemplateDetail,
  PlatformIndustryTemplateSummary,
} from "@banijjik/contracts";
import type { IndustryTemplate } from "../../domain/industry-template.entity.js";

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

export function toIndustryTemplateDetail(
  template: IndustryTemplate,
): PlatformIndustryTemplateDetail {
  return {
    ...toIndustryTemplateSummary(template),
    description: template.description,
    configuration: template.configuration,
    createdAt: template.createdAt.toISOString(),
  };
}

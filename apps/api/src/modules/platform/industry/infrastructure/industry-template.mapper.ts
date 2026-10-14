import { isIndustryTemplateKey, type IndustryTemplateConfiguration } from "@banijjik/contracts";
import { asId, type IndustryTemplateId } from "@banijjik/ids";
import { stripMongoInternals } from "../../../../kernel/db/index.js";
import { IndustryTemplate } from "../domain/industry-template.entity.js";
import { invalidIndustryTemplateField } from "../domain/errors.js";
import type { IndustryTemplateDocument } from "./industry-template.schema.js";

/** The seed writes the actor as the system (null). */
export function toIndustryTemplateDocument(template: IndustryTemplate): IndustryTemplateDocument {
  return {
    industryTemplateId: template.industryTemplateId,
    industryTemplateKey: template.industryTemplateKey,
    status: template.status,
    name: template.name,
    description: template.description,
    iconKey: template.iconKey,
    enabledKinds: [...template.enabledKinds],
    allowedModuleKeys: [...template.allowedModuleKeys],
    configuration: template.configuration,
    version: template.version,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    createdByUserId: null,
    updatedByUserId: null,
  };
}

export function toIndustryTemplate(document: IndustryTemplateDocument): IndustryTemplate {
  const stored = stripMongoInternals(document);
  if (!isIndustryTemplateKey(stored.industryTemplateKey)) {
    throw invalidIndustryTemplateField("industryTemplateKey");
  }
  return IndustryTemplate.restore({
    industryTemplateId: asId<IndustryTemplateId>(stored.industryTemplateId),
    industryTemplateKey: stored.industryTemplateKey,
    status: stored.status,
    name: stored.name,
    description: stored.description,
    iconKey: stored.iconKey,
    enabledKinds: stored.enabledKinds,
    allowedModuleKeys: stored.allowedModuleKeys,
    // Safe: the configuration was checked by industryTemplateConfigurationSchema before it was stored.
    configuration: stored.configuration as IndustryTemplateConfiguration,
    version: stored.version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  });
}

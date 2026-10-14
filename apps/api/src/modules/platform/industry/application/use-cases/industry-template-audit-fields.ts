import type { AuditFields } from "../../../../../kernel/audit/index.js";
import type { IndustryTemplate } from "../../domain/industry-template.entity.js";

/** Top-level fields an audit entry can store. Configuration is a flag, not the document. */
export function auditFieldsOf(
  template: IndustryTemplate,
  configurationChanged: boolean,
): AuditFields {
  const fields: Record<string, AuditFields[string]> = {
    industryTemplateKey: template.industryTemplateKey,
    status: template.status,
    "name.bn": template.name.bn,
    "name.en": template.name.en,
    "description.bn": template.description.bn,
    "description.en": template.description.en,
    iconKey: template.iconKey,
    enabledKinds: [...template.enabledKinds],
    allowedModuleKeys: [...template.allowedModuleKeys],
  };
  if (configurationChanged) fields["configuration"] = true;
  return fields;
}

export function sameConfiguration(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

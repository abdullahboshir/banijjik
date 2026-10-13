import { LIMIT_KEY_VALUES } from "@banijjik/contracts";
import { type AuditFields } from "../../../../../kernel/audit/index.js";
import { Package } from "../../domain/package.entity.js";

export function auditFieldsOf(subject: Package): AuditFields {
  const fields: Record<string, AuditFields[string]> = {
    packageKey: subject.packageKey,
    name: subject.name,
    isAddOn: subject.isAddOn,
    status: subject.status,
    moduleKeys: [...subject.moduleKeys],
  };
  for (const limitKey of LIMIT_KEY_VALUES) {
    fields[`limits.${limitKey}`] = subject.limits[limitKey];
    const increment = subject.limitIncrements[limitKey];
    if (increment !== undefined) fields[`limitIncrements.${limitKey}`] = increment;
  }
  return fields;
}

import {
  CUSTOM_FIELD_TYPE,
  type IndustryTemplateConfiguration,
  type IndustryTemplateCustomField,
} from "@banijjik/contracts";

/** The parts of a template the additive rule compares (ADR-046, ADR-076). */
export interface AdditiveTemplate {
  readonly enabledKinds: readonly string[];
  readonly allowedModuleKeys: readonly string[];
  readonly configuration: IndustryTemplateConfiguration;
}

const SELECT_TYPES: readonly string[] = [CUSTOM_FIELD_TYPE.SELECT, CUSTOM_FIELD_TYPE.MULTI_SELECT];

function missing(category: string, before: readonly string[], after: readonly string[]): string[] {
  const kept = new Set(after);
  return before.filter((item) => !kept.has(item)).map((item) => `${category}:${item}`);
}

function fieldIdentity(field: IndustryTemplateCustomField): string {
  const offeringKind = field.offeringKind ?? "";
  return `${field.entityType}:${offeringKind}:${field.fieldKey}`;
}

function removedFields(
  before: readonly IndustryTemplateCustomField[],
  after: readonly IndustryTemplateCustomField[],
): string[] {
  const kept = new Set(after.map(fieldIdentity));
  return before
    .filter((field) => !kept.has(fieldIdentity(field)))
    .map((field) => `customField:${fieldIdentity(field)}`);
}

function removedOptions(
  before: readonly IndustryTemplateCustomField[],
  after: readonly IndustryTemplateCustomField[],
): string[] {
  const nextByIdentity = new Map(after.map((field) => [fieldIdentity(field), field]));
  const removed: string[] = [];
  for (const field of before) {
    if (!SELECT_TYPES.includes(field.fieldType)) continue;
    const next = nextByIdentity.get(fieldIdentity(field));
    if (next === undefined) continue;
    const kept = new Set(next.options ?? []);
    for (const option of field.options ?? []) {
      if (!kept.has(option)) removed.push(`option:${fieldIdentity(field)}:${option}`);
    }
  }
  return removed;
}

/** Every kind, module, field, key or SELECT option `after` would drop. An empty list is additive. */
export function removedByTemplateChange(
  before: AdditiveTemplate,
  after: AdditiveTemplate,
): readonly string[] {
  const removed = [
    ...missing("kind", before.enabledKinds, after.enabledKinds),
    ...missing("module", before.allowedModuleKeys, after.allowedModuleKeys),
    ...removedFields(before.configuration.customFields, after.configuration.customFields),
    ...removedOptions(before.configuration.customFields, after.configuration.customFields),
    ...missing(
      "term",
      Object.keys(before.configuration.terms),
      Object.keys(after.configuration.terms),
    ),
    ...missing(
      "contactRole",
      before.configuration.contactRoleKeys,
      after.configuration.contactRoleKeys,
    ),
    ...missing("relation", before.configuration.relationKeys, after.configuration.relationKeys),
    ...missing(
      "resourceType",
      before.configuration.resourceTypes.map((resource) => resource.resourceTypeKey),
      after.configuration.resourceTypes.map((resource) => resource.resourceTypeKey),
    ),
  ];
  return removed.sort();
}

/** Kinds and modules the target would drop. An organization move checks only these two. */
export function removedKindsAndModules(
  current: Pick<AdditiveTemplate, "enabledKinds" | "allowedModuleKeys">,
  target: Pick<AdditiveTemplate, "enabledKinds" | "allowedModuleKeys">,
): readonly string[] {
  return [
    ...missing("kind", current.enabledKinds, target.enabledKinds),
    ...missing("module", current.allowedModuleKeys, target.allowedModuleKeys),
  ].sort();
}

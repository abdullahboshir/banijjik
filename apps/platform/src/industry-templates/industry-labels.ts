import {
  CONTACT_ROLE,
  CUSTOM_FIELD_ENTITY_TYPE,
  CUSTOM_FIELD_TYPE,
  INDUSTRY_TEMPLATE_STATUS,
  MODULE_CLASS,
  OFFERING_KIND,
  RELATION_KEY,
} from "@banijjik/contracts";
import type { Translator, TranslationValues } from "@banijjik/i18n";
import { MODULE_LABEL_KEYS, moduleClassLabelKey } from "../packages/module-catalog";
import { REMOVED_ITEM_LABEL_KEYS } from "./removed-items";

const STATIC_LABEL_KEYS = [
  "platform.industries.new",
  "platform.industry.startEmpty",
  "platform.industry.copyFrom",
  "platform.industry.created",
  "platform.industry.saved",
  "platform.industry.readOnly",
  "platform.industry.section.basics",
  "platform.industry.section.kinds",
  "platform.industry.section.modules",
  "platform.industry.section.terms",
  "platform.industry.section.fields",
  "platform.industry.section.settings",
  "platform.industry.section.roles",
  "platform.industry.section.bot",
  ...["basics", "kinds", "terms", "fields", "settings", "roles", "bot"].map(
    (section) => `platform.industry.section.${section}.help`,
  ),
  "platform.industry.locked.IN_USE",
  "platform.industry.action.save",
  "platform.industry.action.publish",
  "platform.industry.action.retire",
  "platform.industry.action.addField",
  "platform.industry.action.addTerm",
  "platform.industry.action.addResource",
  "platform.industry.action.addKnowledge",
  "platform.industry.action.remove",
  "platform.industry.field.key",
  "platform.industry.field.nameBn",
  "platform.industry.field.nameEn",
  "platform.industry.field.descriptionBn",
  "platform.industry.field.descriptionEn",
  "platform.industry.field.iconKey",
  "platform.industry.field.cloneFrom",
  "platform.industry.field.termKey",
  "platform.industry.field.termBn",
  "platform.industry.field.termEn",
  "platform.industry.field.entityType",
  "platform.industry.field.fieldKey",
  "platform.industry.field.fieldType",
  "platform.industry.field.offeringKind",
  "platform.industry.field.required",
  "platform.industry.field.botAsk",
  "platform.industry.field.searchable",
  "platform.industry.field.sensitive",
  "platform.industry.field.visibilityAdmin",
  "platform.industry.field.visibilityStorefront",
  "platform.industry.field.visibilityBot",
  "platform.industry.field.labelBn",
  "platform.industry.field.labelEn",
  "platform.industry.field.optionValue",
  "platform.industry.field.referenceEntity",
  "platform.industry.field.relationKey",
  "platform.industry.field.createIfMissing",
  "platform.industry.field.defaultBillTo",
  "platform.industry.field.resourceTypeKey",
  "platform.industry.field.resourceTerm",
  "platform.industry.field.isMember",
  "platform.industry.field.personaKey",
  "platform.industry.field.handoffTopics",
  "platform.industry.field.websiteKeys",
  "platform.industry.field.useSystemDefault",
  "platform.industry.field.systemDefault",
  "platform.industry.settings.pending",
  "platform.industry.settings.structured",
  "platform.industry.fields.empty",
  "platform.industry.badge.required",
  "platform.industry.badge.botAsk",
  "platform.industry.badge.sensitive",
  "platform.industry.knowledge.draft",
  "platform.field.reason",
  "platform.field.reasonHint",
  "platform.reference.contact",
  "platform.reference.member",
  "validation.invalid_value",
  ...REMOVED_ITEM_LABEL_KEYS,
  ...Object.values(INDUSTRY_TEMPLATE_STATUS)
    .filter((status) => status !== "DRAFT")
    .map((status) => `platform.industry.locked.${status}`),
  ...Object.values(OFFERING_KIND).map((kind) => `platform.kind.${kind}`),
  ...Object.values(CUSTOM_FIELD_TYPE).map((fieldType) => `platform.fieldType.${fieldType}`),
  ...Object.values(CUSTOM_FIELD_ENTITY_TYPE).map((entityType) => `platform.entity.${entityType}`),
  ...Object.values(CONTACT_ROLE).map((role) => `platform.contactRole.${role}`),
  ...Object.values(RELATION_KEY).map((relation) => `platform.relation.${relation}`),
  ...MODULE_LABEL_KEYS,
  ...Object.values(MODULE_CLASS).map(moduleClassLabelKey),
] as const;

export type IndustryLabels = Readonly<Record<string, string>>;

/** Server-rendered text for the industry screens. The platform catalogs stay off the browser bundle. */
export function buildIndustryLabels(t: Translator["t"]): IndustryLabels {
  return Object.fromEntries(STATIC_LABEL_KEYS.map((key) => [key, t(key)]));
}

/** Looks up a label the server already translated, then fills {name} style placeholders. */
export function labelsTranslator(labels: IndustryLabels): Translator["t"] {
  return (key: string, values?: TranslationValues) => {
    const text = labels[key] ?? key;
    if (values === undefined) return text;
    return text.replace(/\{(\w+)\}/gu, (placeholder, name: string) =>
      String(values[name] ?? placeholder),
    );
  };
}

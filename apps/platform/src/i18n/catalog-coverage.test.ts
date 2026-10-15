import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONTACT_ROLE,
  CUSTOM_FIELD_ENTITY_TYPE,
  CUSTOM_FIELD_TYPE,
  INDUSTRY_TEMPLATE_STATUS,
  LIMIT_KEY_VALUES,
  MODULE_CLASS,
  OFFERING_KIND,
  ORGANIZATION_STATUS,
  PACKAGE_STATUS,
  PLATFORM_AUDIT_ACTION,
  PLATFORM_AUDIT_TARGET_TYPE,
  RELATION_KEY,
  SUBSCRIPTION_STATUS,
  MODULE_OVERRIDE_EFFECT,
} from "@banijjik/contracts";
import { BUNDLED_CATALOGS, PLATFORM_SCREEN_CATALOGS, SUPPORTED_LOCALES } from "@banijjik/i18n";
import { describe, expect, it } from "vitest";
import { PACKAGE_FORM_LABEL_KEYS } from "../packages/package-form-labels";
import { MODULE_LABEL_KEYS, moduleClassLabelKey } from "../packages/module-catalog";
import { REMOVED_ITEM_LABEL_KEYS } from "../industry-templates/removed-items";
import { REMOVE_OVERRIDE_LABEL_KEYS } from "../tenants/remove-override-labels";
import { TENANT_ACTION_LABEL_KEYS } from "../tenants/tenant-action-labels";

const SOURCE_ROOT = join(import.meta.dirname, "..", "..");
const SOURCE_FOLDERS = ["app", "src"];
const KEY_LITERAL =
  /"((?:platform|auth|account|shell|common|state|errors|validation)\.[A-Za-z0-9_.]+)"/g;

function sourceFilesIn(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return sourceFilesIn(path);
    const isSource = /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name);
    return isSource ? [path] : [];
  });
}

function keyLiteralsOfTheApp(): string[] {
  const keys = SOURCE_FOLDERS.flatMap((folder) => sourceFilesIn(join(SOURCE_ROOT, folder))).flatMap(
    (file) =>
      Array.from(readFileSync(file, "utf8").matchAll(KEY_LITERAL), (match) => match[1] ?? ""),
  );
  return [...new Set(keys)];
}

/** The keys that the code builds from an enum value instead of writing them out. */
function enumeratedKeys(): string[] {
  return [
    ...Object.values(ORGANIZATION_STATUS).map((status) => `platform.status.organization.${status}`),
    ...Object.values(SUBSCRIPTION_STATUS).map((status) => `platform.status.subscription.${status}`),
    ...Object.values(PACKAGE_STATUS).map((status) => `platform.status.package.${status}`),
    ...Object.values(MODULE_OVERRIDE_EFFECT).map((effect) => `platform.override.effect.${effect}`),
    ...Object.values(PLATFORM_AUDIT_ACTION).map((action) => `platform.audit.action.${action}`),
    ...Object.values(PLATFORM_AUDIT_TARGET_TYPE).map((type) => `platform.audit.target.${type}`),
    ...Object.values(MODULE_CLASS).map(moduleClassLabelKey),
    ...LIMIT_KEY_VALUES.map((limitKey) => `platform.limit.${limitKey}`),
    ...MODULE_LABEL_KEYS,
    ...TENANT_ACTION_LABEL_KEYS,
    ...REMOVE_OVERRIDE_LABEL_KEYS,
    ...PACKAGE_FORM_LABEL_KEYS,
    ...REMOVED_ITEM_LABEL_KEYS,
    ...Object.values(INDUSTRY_TEMPLATE_STATUS).map(
      (status) => `platform.status.industryTemplate.${status}`,
    ),
    ...Object.values(OFFERING_KIND).map((kind) => `platform.kind.${kind}`),
    ...Object.values(CUSTOM_FIELD_TYPE).map((fieldType) => `platform.fieldType.${fieldType}`),
    ...Object.values(CUSTOM_FIELD_ENTITY_TYPE).map((entityType) => `platform.entity.${entityType}`),
    ...Object.values(CONTACT_ROLE).map((role) => `platform.contactRole.${role}`),
    ...Object.values(RELATION_KEY).map((relation) => `platform.relation.${relation}`),
    "platform.industry.action.publish",
    "platform.industry.action.retire",
    "platform.industry.locked.PUBLISHED",
    "platform.industry.locked.RETIRED",
  ];
}

describe.each(SUPPORTED_LOCALES)("text of the platform app in %s", (locale) => {
  const known = { ...BUNDLED_CATALOGS[locale], ...PLATFORM_SCREEN_CATALOGS[locale] };

  it("exists for every key the code writes out", () => {
    const missing = keyLiteralsOfTheApp().filter((key) => known[key] === undefined);
    expect(missing).toEqual([]);
  });

  it("exists for every key the code builds from a status, action, module or limit", () => {
    const missing = enumeratedKeys().filter((key) => known[key] === undefined);
    expect(missing).toEqual([]);
  });

  it("has no platform key that nothing uses", () => {
    const used = new Set([...keyLiteralsOfTheApp(), ...enumeratedKeys()]);
    const unused = Object.keys(PLATFORM_SCREEN_CATALOGS[locale]).filter((key) => !used.has(key));
    expect(unused).toEqual([]);
  });
});

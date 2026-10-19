import type { ModuleManifest } from "@banijjik/contracts";
import { createModuleRegistry, type ModuleRegistry } from "../kernel/modules/index.js";
import { auditManifest } from "../modules/core/audit/index.js";
import { iamManifest } from "../modules/core/iam/index.js";
import { organizationManifest } from "../modules/core/organization/index.js";
import { entitlementManifest } from "../modules/platform/entitlement/index.js";
import { industryManifest } from "../modules/platform/industry/index.js";
import { operationsManifest } from "../modules/platform/operations/index.js";
import { packageManifest } from "../modules/platform/package/index.js";
import { saasBillingManifest } from "../modules/platform/saas-billing/index.js";
import { customFieldManifest } from "../modules/core/custom-field/index.js";
import { fileManifest } from "../modules/core/file/index.js";
import { accountingManifest } from "../modules/commerce/accounting/index.js";
import { catalogManifest } from "../modules/commerce/catalog/index.js";
import { contactManifest } from "../modules/commerce/contact/index.js";
import { expenseManifest } from "../modules/commerce/expense/index.js";
import { pricingManifest } from "../modules/commerce/pricing/index.js";
import { inventoryManifest } from "../modules/commerce/inventory/index.js";
import { settingsManifest } from "../modules/core/settings/index.js";
import { tenantAdminManifest } from "../modules/platform/tenant-admin/index.js";

/** Every manifest of the application. A module joins the product by adding its manifest here. */
export const MODULE_MANIFESTS: readonly ModuleManifest[] = [
  iamManifest,
  organizationManifest,
  auditManifest,
  packageManifest,
  industryManifest,
  saasBillingManifest,
  entitlementManifest,
  tenantAdminManifest,
  operationsManifest,
  customFieldManifest,
  settingsManifest,
  fileManifest,
  accountingManifest,
  contactManifest,
  catalogManifest,
  expenseManifest,
  pricingManifest,
  inventoryManifest,
];

/**
 * Builds and validates the registry at startup (ADR-091). `extraManifests` is for tests, which
 * register a probe module through the same registry; production passes none.
 */
export function buildModuleRegistry(
  extraManifests: readonly ModuleManifest[] = [],
): ModuleRegistry {
  return createModuleRegistry([...MODULE_MANIFESTS, ...extraManifests]);
}

/**
 * Every module of the product, built or not yet (10-MODULE-CATALOG section 5). Package seed data
 * may name modules that arrive in later phases, so packages are validated against this list and
 * not against the manifests that are registered today. Values are kebab-case (ADR-054).
 */
export const MODULE_KEY = {
  INDUSTRY: "industry",
  PACKAGE: "package",
  ENTITLEMENT: "entitlement",
  SAAS_BILLING: "saas-billing",
  TENANT_ADMIN: "tenant-admin",
  OPERATIONS: "operations",
  AI: "ai",
  IAM: "iam",
  ORGANIZATION: "organization",
  CUSTOM_FIELD: "custom-field",
  SETTINGS: "settings",
  AUDIT: "audit",
  FILE: "file",
  NOTIFICATION: "notification",
  ACCOUNTING: "accounting",
  CONTACT: "contact",
  CATALOG: "catalog",
  INVENTORY: "inventory",
  PRICING: "pricing",
  SALES: "sales",
  BOOKING: "booking",
  ENROLLMENT: "enrollment",
  PAYMENT: "payment",
  EXPENSE: "expense",
  REPORT: "report",
  DELIVERY: "delivery",
  COURIER: "courier",
  SMS: "sms",
  RISK: "risk",
  POS: "pos",
  BOOKKEEPING: "bookkeeping",
  WEBSITE: "website",
  PAYMENT_GATEWAY: "payment-gateway",
  MESSAGING: "messaging",
  BOT: "bot",
  SOCIAL: "social",
  WORKFLOW: "workflow",
  ACADEMIC: "academic",
  CLINICAL: "clinical",
  KITCHEN_DISPLAY: "kitchen-display",
} as const;

export type ModuleKey = (typeof MODULE_KEY)[keyof typeof MODULE_KEY];

export const MODULE_KEY_VALUES: readonly ModuleKey[] = Object.values(MODULE_KEY);

export function isModuleKey(value: string): value is ModuleKey {
  return (MODULE_KEY_VALUES as readonly string[]).includes(value);
}

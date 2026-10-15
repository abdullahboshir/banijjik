import { PLATFORM_PERMISSION_KEY, type PlatformPermissionKey } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { holdsPermission } from "../auth/permissions";

export interface NavigationEntry {
  menuKey: string;
  label: string;
  href: string;
  iconKey: string;
}

interface EntryDefinition {
  menuKey: string;
  labelKey: string;
  href: string;
  iconKey: string;
  permission: PlatformPermissionKey;
}

const ENTRY_DEFINITIONS: readonly EntryDefinition[] = [
  {
    menuKey: "tenants",
    labelKey: "platform.nav.tenants",
    href: "/tenants",
    iconKey: "users",
    permission: PLATFORM_PERMISSION_KEY.TENANT_READ,
  },
  {
    menuKey: "packages",
    labelKey: "platform.nav.packages",
    href: "/packages",
    iconKey: "package",
    permission: PLATFORM_PERMISSION_KEY.PACKAGE_READ,
  },
  {
    menuKey: "industries",
    labelKey: "platform.nav.industries",
    href: "/industry-templates",
    iconKey: "tag",
    permission: PLATFORM_PERMISSION_KEY.INDUSTRY_READ,
  },
  {
    menuKey: "audit",
    labelKey: "platform.nav.audit",
    href: "/audit",
    iconKey: "receipt",
    permission: PLATFORM_PERMISSION_KEY.AUDIT_READ,
  },
  {
    menuKey: "operators",
    labelKey: "platform.nav.operators",
    href: "/operators",
    iconKey: "user",
    permission: PLATFORM_PERMISSION_KEY.OPERATOR_READ,
  },
];

/** The entries this operator may open, in menu order. The permissions come from `GET /platform/me`. */
export function navigationEntriesFor(
  operator: { permissions: readonly PlatformPermissionKey[] },
  t: Translator["t"],
): NavigationEntry[] {
  return ENTRY_DEFINITIONS.filter((entry) => holdsPermission(operator, entry.permission)).map(
    (entry) => ({
      menuKey: entry.menuKey,
      label: t(entry.labelKey),
      href: entry.href,
      iconKey: entry.iconKey,
    }),
  );
}

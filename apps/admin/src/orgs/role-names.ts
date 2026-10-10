import { SYSTEM_ROLE_KEY, systemRoleNameKey, type SystemRoleKey } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";

const ROLE_SEPARATOR = ", ";

function isSystemRoleKey(roleKey: string): roleKey is SystemRoleKey {
  // Safe: widening to string[] only lets `includes` accept an arbitrary string; nothing is written.
  return (Object.values(SYSTEM_ROLE_KEY) as string[]).includes(roleKey);
}

/** Display names of the person's roles. Custom roles have no catalog name yet, so they are left out. */
export function roleNamesOf(roleKeys: readonly string[], t: Translator["t"]): string {
  return roleKeys
    .filter(isSystemRoleKey)
    .map((roleKey) => t(systemRoleNameKey(roleKey)))
    .join(ROLE_SEPARATOR);
}

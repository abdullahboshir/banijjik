import { defineEnum } from "../define-enum.js";

/** The roles every organization gets at creation (09-DOMAIN-MODEL section 4.5). Their permissions come from code templates (card 1.4). */
export const SYSTEM_ROLE_KEY = defineEnum([
  "OWNER",
  "MANAGER",
  "CASHIER",
  "STAFF",
  "RIDER",
  "VIEWER",
]);

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEY)[keyof typeof SYSTEM_ROLE_KEY];

/** Message key of a system role's display name, e.g. OWNER becomes "role.owner". */
export function systemRoleNameKey(roleKey: SystemRoleKey): string {
  return `role.${roleKey.toLowerCase()}`;
}

/** Every system role name key, so both catalogs can be checked against it. */
export const SYSTEM_ROLE_NAME_MESSAGE_KEYS: readonly string[] = Object.values(SYSTEM_ROLE_KEY).map(
  (roleKey) => systemRoleNameKey(roleKey),
);

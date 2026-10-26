import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import type { ModuleGrants } from "./system-role-grants.js";

/**
 * What each system role gets from the report module (card 3.10). The whole business figures stay
 * with the owner and the manager; cashiers, staff, riders and viewers get no report screen or read.
 */
export const REPORT_ROLE_GRANTS: ModuleGrants = {
  [SYSTEM_ROLE_KEY.OWNER]: "ALL",
  [SYSTEM_ROLE_KEY.MANAGER]: "ALL",
  [SYSTEM_ROLE_KEY.CASHIER]: "NONE",
  [SYSTEM_ROLE_KEY.STAFF]: "NONE",
  [SYSTEM_ROLE_KEY.RIDER]: "NONE",
  [SYSTEM_ROLE_KEY.VIEWER]: "NONE",
};

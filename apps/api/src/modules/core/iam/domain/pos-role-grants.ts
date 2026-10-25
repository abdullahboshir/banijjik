import { PERMISSION_KEY, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import type { ModuleGrants } from "./system-role-grants.js";

/**
 * What each system role gets from the POS module (card 3.9). A cashier rings up sales and counts
 * their own drawer; devices and every register's report stay with the owner and manager. Kept in
 * its own file because the table in `system-role-grants.ts` is at its line cap.
 */
export const POS_ROLE_GRANTS: ModuleGrants = {
  [SYSTEM_ROLE_KEY.OWNER]: "ALL",
  [SYSTEM_ROLE_KEY.MANAGER]: "ALL",
  [SYSTEM_ROLE_KEY.CASHIER]: {
    only: [
      PERMISSION_KEY.POS_SESSION_OPEN,
      PERMISSION_KEY.POS_SALE_CREATE,
      PERMISSION_KEY.POS_REGISTER_CLOSE,
    ],
  },
  [SYSTEM_ROLE_KEY.STAFF]: "NONE",
  [SYSTEM_ROLE_KEY.RIDER]: "NONE",
  [SYSTEM_ROLE_KEY.VIEWER]: "NONE",
};

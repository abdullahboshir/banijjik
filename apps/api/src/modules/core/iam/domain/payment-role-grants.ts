import { PERMISSION_KEY, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import type { ModuleGrants } from "./system-role-grants.js";

/** What each system role gets from the payment module (card 3.10 extraction, moved unchanged from system-role-grants.ts). */
export const PAYMENT_ROLE_GRANTS: ModuleGrants = {
  [SYSTEM_ROLE_KEY.OWNER]: "ALL",
  [SYSTEM_ROLE_KEY.MANAGER]: "ALL",
  [SYSTEM_ROLE_KEY.CASHIER]: {
    only: [
      PERMISSION_KEY.PAYMENT_PAYMENT_READ,
      PERMISSION_KEY.PAYMENT_PAYMENT_RECEIVE,
      PERMISSION_KEY.PAYMENT_DUE_READ,
      PERMISSION_KEY.PAYMENT_STORE_CREDIT_READ,
    ],
  },
  [SYSTEM_ROLE_KEY.STAFF]: {
    only: [
      PERMISSION_KEY.PAYMENT_PAYMENT_READ,
      PERMISSION_KEY.PAYMENT_PAYMENT_RECEIVE,
      PERMISSION_KEY.PAYMENT_DUE_READ,
      PERMISSION_KEY.PAYMENT_STORE_CREDIT_READ,
    ],
  },
  [SYSTEM_ROLE_KEY.RIDER]: "NONE",
  [SYSTEM_ROLE_KEY.VIEWER]: "READ",
};

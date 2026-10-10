import { defineEnum } from "../define-enum.js";

/** REMOVED keeps the member's history, because requests reference `memberId` (09-DOMAIN-MODEL section 4.4). */
export const MEMBER_STATUS = defineEnum(["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"]);

export type MemberStatus = (typeof MEMBER_STATUS)[keyof typeof MEMBER_STATUS];

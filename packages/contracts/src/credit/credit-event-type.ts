import { defineEnum } from "../define-enum.js";

export const CREDIT_EVENT_TYPE = defineEnum(["CREDIT_ENTRY_CREATED", "UNLOCK_CREATED"]);
export type CreditEventType = (typeof CREDIT_EVENT_TYPE)[keyof typeof CREDIT_EVENT_TYPE];

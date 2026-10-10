import { defineEnum } from "../define-enum.js";

/** Why code bypasses tenant filtering (05-CONVENTIONS "System access"). A closed list on purpose. */
export const SYSTEM_REASON = defineEnum([
  "AUTH_LOOKUP",
  "PERMISSION_RESOLUTION",
  "CONTEXT_SETUP",
  "SEED",
  "PLATFORM_ADMIN",
  "MIGRATION",
  "WEBHOOK_ROUTING",
  "SCHEDULED_JOB",
]);

export type SystemReason = (typeof SYSTEM_REASON)[keyof typeof SYSTEM_REASON];

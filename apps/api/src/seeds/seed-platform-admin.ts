import { SYSTEM_REASON } from "@banijjik/contracts";
import type { AppConfig } from "../config/index.js";
import { runAsSystem } from "../kernel/context/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildPlatformAuditRecorder } from "../modules/core/audit/index.js";
import { buildEnsurePlatformAdminUseCase } from "../modules/core/iam/index.js";
import { buildSeededOperatorAudit } from "./seeded-operator-audit.js";

export type SeedPlatformAdminOutcome =
  | { readonly status: "SKIPPED" }
  | {
      readonly status: "DONE";
      readonly isUserCreated: boolean;
      readonly isOperatorCreated: boolean;
    }
  | {
      /** The admin email belongs to an account the configured password does not open (review B1). */
      readonly status: "REFUSED";
      readonly reason: "PASSWORD_MISMATCH";
    };

export interface SeedPlatformAdminOptions {
  readonly config: AppConfig;
  readonly clock: Clock;
}

/**
 * Creates the platform super admin from PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD, unless
 * they are unset. Needs connected databases and registered models. Safe to run again: it never
 * changes an existing user or password, and it never promotes an account the password does not
 * open. The system access mark lives here, outside the modules (R26).
 */
export async function seedPlatformAdmin(
  options: SeedPlatformAdminOptions,
): Promise<SeedPlatformAdminOutcome> {
  const { config, clock } = options;
  if (config.platformAdmin === undefined) return { status: "SKIPPED" };
  const { email, password } = config.platformAdmin;
  const useCase = buildEnsurePlatformAdminUseCase(
    clock,
    buildSeededOperatorAudit(buildPlatformAuditRecorder(clock)),
  );
  const result = await runAsSystem(SYSTEM_REASON.SEED, () => useCase.execute({ email, password }));
  if ("refusal" in result) return { status: "REFUSED", reason: result.refusal };
  return { status: "DONE", ...result };
}

/** A refused seed must fail the deploy step, so a stranger's account is never left looking seeded. */
export function seedExitCode(outcome: SeedPlatformAdminOutcome): number {
  return outcome.status === "REFUSED" ? 1 : 0;
}

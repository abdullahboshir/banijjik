import { SYSTEM_REASON } from "@banijjik/contracts";
import type { AppConfig } from "../config/index.js";
import { runAsSystem } from "../kernel/context/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildEnsurePlatformAdminUseCase } from "../modules/core/iam/index.js";

export type SeedPlatformAdminOutcome =
  | { readonly status: "SKIPPED" }
  | {
      readonly status: "DONE";
      readonly isUserCreated: boolean;
      readonly isOperatorCreated: boolean;
    };

export interface SeedPlatformAdminOptions {
  readonly config: AppConfig;
  readonly clock: Clock;
}

/**
 * Creates the platform super admin from PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD, unless
 * they are unset. Needs connected databases and registered models. Safe to run again: it never
 * changes an existing user or password. The system access mark lives here, outside the modules (R26).
 */
export async function seedPlatformAdmin(
  options: SeedPlatformAdminOptions,
): Promise<SeedPlatformAdminOutcome> {
  const { config, clock } = options;
  if (config.platformAdmin === undefined) return { status: "SKIPPED" };
  const { email, password } = config.platformAdmin;
  const useCase = buildEnsurePlatformAdminUseCase(clock);
  const result = await runAsSystem(SYSTEM_REASON.SEED, () => useCase.execute({ email, password }));
  return { status: "DONE", ...result };
}

import type { ModuleKey, ModuleOverrideEffect } from "@banijjik/contracts";

/** One ModuleOverride of an organization (09 section 4.6) as the resolver reads it. */
export interface ModuleOverrideRecord {
  readonly moduleKey: ModuleKey;
  readonly effect: ModuleOverrideEffect;
  readonly expiresAt: Date | null;
}

/** An override with no expiry never lapses; one with an expiry counts until that instant. */
export function isOverrideActive(override: ModuleOverrideRecord, now: Date): boolean {
  return override.expiresAt === null || now.getTime() < override.expiresAt.getTime();
}

/** The earliest future expiry among the overrides: the cached config must be rebuilt from then on. */
export function earliestExpiry(overrides: readonly ModuleOverrideRecord[]): Date | null {
  const expiries = overrides.flatMap((override) =>
    override.expiresAt === null ? [] : [override.expiresAt],
  );
  if (expiries.length === 0) return null;
  return new Date(Math.min(...expiries.map((expiry) => expiry.getTime())));
}

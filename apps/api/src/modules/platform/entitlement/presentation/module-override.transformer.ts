import type { PlatformModuleOverrideResponse } from "@banijjik/contracts";
import type { ModuleOverrideView } from "../application/ports/override-admin-ports.js";

export function toModuleOverrideResponse(view: ModuleOverrideView): PlatformModuleOverrideResponse {
  return {
    moduleOverrideId: view.moduleOverrideId,
    moduleKey: view.moduleKey,
    effect: view.effect,
    reason: view.reason,
    expiresAt: view.expiresAt === null ? null : view.expiresAt.toISOString(),
    createdAt: view.createdAt.toISOString(),
  };
}

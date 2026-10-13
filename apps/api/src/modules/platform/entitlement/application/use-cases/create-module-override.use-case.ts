import {
  PLATFORM_AUDIT_ACTION,
  PLATFORM_AUDIT_TARGET_TYPE,
  SYSTEM_REASON,
  type ModuleKey,
  type ModuleOverrideEffect,
} from "@banijjik/contracts";
import { newId, type ModuleOverrideId, type UserId } from "@banijjik/ids";
import { runAsSystem } from "../../../../../kernel/context/index.js";
import { assertOverridable } from "../../domain/module-override-rules.js";
import { expiryInPast } from "../../domain/override-errors.js";
import type { ModuleOverrideView } from "../ports/override-admin-ports.js";
import { OverrideSupport } from "./override-support.js";

export interface CreateModuleOverrideInput {
  readonly actorUserId: UserId;
  readonly organizationId: string;
  readonly moduleKey: ModuleKey;
  readonly effect: Extract<ModuleOverrideEffect, "PLATFORM_GRANT" | "PLATFORM_REVOKE">;
  readonly reason: string;
  readonly expiresAt?: Date | undefined;
}

/** Grants or revokes one module for one organization, outside its package (10 section 3, step 1). */
export class CreateModuleOverrideUseCase extends OverrideSupport {
  async execute(input: CreateModuleOverrideInput): Promise<ModuleOverrideView> {
    const { clock, manifests } = this.dependencies;
    await this.requireOrganization(input.organizationId);
    assertOverridable(input.moduleKey, manifests.all());
    const expiresAt = input.expiresAt ?? null;
    if (expiresAt !== null && expiresAt.getTime() <= clock.now().getTime()) throw expiryInPast();
    const row: ModuleOverrideView = {
      moduleOverrideId: newId<ModuleOverrideId>(),
      organizationId: input.organizationId,
      moduleKey: input.moduleKey,
      effect: input.effect,
      reason: input.reason,
      expiresAt,
      createdAt: clock.now(),
    };
    await this.store(row, input.actorUserId);
    return row;
  }

  private store(row: ModuleOverrideView, actorUserId: UserId): Promise<void> {
    const { overrides, configVersion, unitOfWork, platformAudit } = this.dependencies;
    return runAsSystem(SYSTEM_REASON.PLATFORM_ADMIN, () =>
      unitOfWork.run(async () => {
        await overrides.insert(row, actorUserId);
        await configVersion.bump(row.organizationId);
        await platformAudit.record({
          action: PLATFORM_AUDIT_ACTION.MODULE_OVERRIDE_CREATED,
          targetType: PLATFORM_AUDIT_TARGET_TYPE.module_override,
          targetId: row.moduleOverrideId,
          organizationId: row.organizationId,
          changes: {
            moduleKey: { to: row.moduleKey },
            effect: { to: row.effect },
            ...(row.expiresAt === null ? {} : { expiresAt: { to: row.expiresAt.toISOString() } }),
          },
          reason: row.reason,
        });
      }),
    );
  }
}

import {
  PLATFORM_AUDIT_ACTION,
  PLATFORM_AUDIT_TARGET_TYPE,
  SYSTEM_REASON,
} from "@banijjik/contracts";
import { runAsSystem } from "../../../../../kernel/context/index.js";
import { overrideNotFound } from "../../domain/override-errors.js";
import { OverrideSupport } from "./override-support.js";

export interface DeleteModuleOverrideInput {
  readonly organizationId: string;
  readonly moduleOverrideId: string;
}

/** Removes an override. Overrides are configuration, not ledger data, so they are deleted (ADR-078). */
export class DeleteModuleOverrideUseCase extends OverrideSupport {
  async execute(input: DeleteModuleOverrideInput): Promise<void> {
    const { overrides, configVersion, unitOfWork, platformAudit } = this.dependencies;
    await this.requireOrganization(input.organizationId);
    await runAsSystem(SYSTEM_REASON.PLATFORM_ADMIN, async () => {
      const existing = await overrides.findById(input.organizationId, input.moduleOverrideId);
      if (existing === undefined) throw overrideNotFound();
      await unitOfWork.run(async () => {
        await overrides.delete(input.organizationId, input.moduleOverrideId);
        await configVersion.bump(input.organizationId);
        await platformAudit.record({
          action: PLATFORM_AUDIT_ACTION.MODULE_OVERRIDE_DELETED,
          targetType: PLATFORM_AUDIT_TARGET_TYPE.module_override,
          targetId: existing.moduleOverrideId,
          organizationId: input.organizationId,
          changes: { moduleKey: { from: existing.moduleKey }, effect: { from: existing.effect } },
          reason: existing.reason,
        });
      });
    });
  }
}

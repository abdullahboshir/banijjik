import {
  PLATFORM_AUDIT_ACTION,
  PLATFORM_AUDIT_TARGET_TYPE,
  SYSTEM_REASON,
  type ModuleKey,
  type ModuleOverrideEffect,
} from "@banijjik/contracts";
import { newId, type ModuleOverrideId, type UserId } from "@banijjik/ids";
import type { PlatformAuditRecorder } from "../../../../../kernel/audit/index.js";
import { runAsSystem } from "../../../../../kernel/context/index.js";
import type { ConfigVersionBumper } from "../../../../../kernel/tenancy/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { assertOverridable } from "../../domain/module-override-rules.js";
import { expiryInPast, overrideNotFound } from "../../domain/override-errors.js";
import type {
  ModuleOverrideAdminRepository,
  ModuleOverrideView,
  OrganizationExistence,
  OverrideManifestCatalog,
  OverrideUnitOfWork,
} from "../ports/override-admin-ports.js";

export interface ModuleOverrideAdminDependencies {
  readonly overrides: ModuleOverrideAdminRepository;
  readonly organizations: OrganizationExistence;
  readonly manifests: OverrideManifestCatalog;
  /** Every write moves `configVersion` in the same transaction, so the next request resolves the change. */
  readonly configVersion: ConfigVersionBumper;
  readonly unitOfWork: OverrideUnitOfWork;
  readonly platformAudit: PlatformAuditRecorder;
  readonly clock: Clock;
}

abstract class OverrideSupport {
  constructor(protected readonly dependencies: ModuleOverrideAdminDependencies) {}

  /** An unknown organization is a 404 before any tenant data is touched. */
  protected async requireOrganization(organizationId: string): Promise<void> {
    if (!(await this.dependencies.organizations.exists(organizationId))) throw overrideNotFound();
  }
}

export class ListModuleOverridesUseCase extends OverrideSupport {
  async execute(input: {
    readonly organizationId: string;
  }): Promise<readonly ModuleOverrideView[]> {
    await this.requireOrganization(input.organizationId);
    // The read leaves only the system_access log line (plan 1.8a decision 5).
    return runAsSystem(SYSTEM_REASON.PLATFORM_ADMIN, () =>
      this.dependencies.overrides.list(input.organizationId),
    );
  }
}

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

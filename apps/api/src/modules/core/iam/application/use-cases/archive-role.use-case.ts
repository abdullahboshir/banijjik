import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import type { OrganizationId, RoleId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { roleInUse, roleNotFound } from "../../domain/errors.js";
import type { PermissionResolver } from "../permission-resolver.js";
import type { MemberAccessReader } from "../ports/member-access-reader.js";
import type { RoleManagementRepository } from "../ports/role-management-repository.js";
import type { RolesVersionBumper } from "../ports/roles-version-bumper.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";
import { toRoleView, type RoleView } from "../role-view.js";

export interface ArchiveRoleInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly roleId: RoleId;
  readonly version: number;
}

export interface ArchiveRoleDependencies {
  readonly roles: RoleManagementRepository;
  readonly members: Pick<MemberAccessReader, "countActiveMembersByRole">;
  readonly rolesVersion: RolesVersionBumper;
  readonly unitOfWork: UnitOfWork;
  readonly resolver: PermissionResolver;
  readonly clock: Clock;
  readonly audit: AuditRecorder;
}

/**
 * Archives a custom role. It is refused while an ACTIVE member still holds it (`ROLE_IN_USE`), so
 * nobody loses access silently. The check, the write and the roles version bump share one
 * transaction (ADR-088).
 */
export class ArchiveRoleUseCase {
  constructor(private readonly dependencies: ArchiveRoleDependencies) {}

  async execute(input: ArchiveRoleInput): Promise<RoleView> {
    const { roles, members, rolesVersion, unitOfWork, resolver, clock } = this.dependencies;
    const existing = await roles.findById(input.roleId);
    if (existing === undefined) throw roleNotFound();
    const archived = existing.archive({ updatedByUserId: input.actorUserId, now: clock.now() });
    const saved = await unitOfWork.run(async () => {
      const holders = await members.countActiveMembersByRole([input.roleId]);
      if ((holders.get(input.roleId) ?? 0) > 0) throw roleInUse();
      const result = await roles.update(archived, input.version);
      await rolesVersion.bump(input.organizationId);
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.ROLE_ARCHIVED,
        entityType: AUDIT_ENTITY_TYPE.role,
        entityId: result.roleId,
        changes: { status: { from: existing.status, to: result.status } },
      });
      return result;
    });
    return toRoleView(saved, resolver);
  }
}

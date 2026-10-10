import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import { IAM_EVENT_TYPE } from "@banijjik/contracts";
import type { OrganizationId, RoleId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { roleNotFound } from "../../domain/errors.js";
import type { PermissionCatalog } from "../permission-catalog.js";
import type { PermissionResolver } from "../permission-resolver.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type { RoleManagementRepository } from "../ports/role-management-repository.js";
import type { RolesVersionBumper } from "../ports/roles-version-bumper.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";
import { toRoleView, type RoleView } from "../role-view.js";
import { diffRoleChanges } from "../role-audit-changes.js";
import { assertKnownPermissionKeys } from "./create-role.use-case.js";

export interface UpdateRoleInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly roleId: RoleId;
  readonly version: number;
  readonly name?: string;
  readonly permissionKeys?: readonly string[];
}

export interface UpdateRoleDependencies {
  readonly roles: RoleManagementRepository;
  readonly rolesVersion: RolesVersionBumper;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly catalog: PermissionCatalog;
  readonly resolver: PermissionResolver;
  readonly clock: Clock;
  readonly audit: AuditRecorder;
}

/**
 * Renames a custom role or changes its permissions. A stale `version` is a 409, a system or
 * archived role is refused by the entity, and the roles version is bumped in the same
 * transaction, so the next request of every holder sees the change (ADR-088).
 */
export class UpdateRoleUseCase {
  constructor(private readonly dependencies: UpdateRoleDependencies) {}

  async execute(input: UpdateRoleInput): Promise<RoleView> {
    const { roles, rolesVersion, unitOfWork, events, catalog, resolver, clock } = this.dependencies;
    if (input.permissionKeys !== undefined) {
      assertKnownPermissionKeys(catalog, input.permissionKeys);
    }
    const existing = await roles.findById(input.roleId);
    if (existing === undefined) throw roleNotFound();
    const edited = existing.edit({
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.permissionKeys === undefined ? {} : { permissionKeys: input.permissionKeys }),
      updatedByUserId: input.actorUserId,
      now: clock.now(),
    });
    const saved = await unitOfWork.run(async () => {
      const result = await roles.update(edited, input.version);
      await rolesVersion.bump(input.organizationId);
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.ROLE_UPDATED,
        entityType: AUDIT_ENTITY_TYPE.role,
        entityId: result.roleId,
        changes: diffRoleChanges(existing, result),
      });
      // A rename alone changes nobody's access, so it publishes nothing.
      if (!existing.hasSamePermissionsAs(edited)) {
        await events.publish(IAM_EVENT_TYPE.ROLE_PERMISSIONS_CHANGED, { roleId: input.roleId });
      }
      return result;
    });
    return toRoleView(saved, resolver);
  }
}

import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import type { OrganizationId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { invalidField } from "../../domain/errors.js";
import { Role } from "../../domain/role.entity.js";
import type { PermissionCatalog } from "../permission-catalog.js";
import type { PermissionResolver } from "../permission-resolver.js";
import type { RoleManagementRepository } from "../ports/role-management-repository.js";
import type { RolesVersionBumper } from "../ports/roles-version-bumper.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";
import { toRoleView, type RoleView } from "../role-view.js";

export interface CreateRoleInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly name: string;
  readonly permissionKeys: readonly string[];
}

export interface CreateRoleDependencies {
  readonly roles: RoleManagementRepository;
  readonly rolesVersion: RolesVersionBumper;
  readonly unitOfWork: UnitOfWork;
  readonly catalog: PermissionCatalog;
  readonly resolver: PermissionResolver;
  readonly clock: Clock;
  readonly audit: AuditRecorder;
}

/** Rejects a key the catalogue does not know, which also keeps platform permissions out of tenant roles. */
export function assertKnownPermissionKeys(
  catalog: PermissionCatalog,
  permissionKeys: readonly string[],
): void {
  if (!permissionKeys.every((key) => catalog.has(key))) {
    throw invalidField("permissionKeys", "validation.invalid_value");
  }
}

/** Creates a custom role and bumps the roles version in the same transaction (ADR-088). */
export class CreateRoleUseCase {
  constructor(private readonly dependencies: CreateRoleDependencies) {}

  async execute(input: CreateRoleInput): Promise<RoleView> {
    const { roles, rolesVersion, unitOfWork, catalog, resolver, clock } = this.dependencies;
    assertKnownPermissionKeys(catalog, input.permissionKeys);
    const role = Role.createCustom({
      organizationId: input.organizationId,
      name: input.name,
      permissionKeys: input.permissionKeys,
      createdByUserId: input.actorUserId,
      now: clock.now(),
    });
    await unitOfWork.run(async () => {
      await roles.insert(role);
      await rolesVersion.bump(input.organizationId);
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.ROLE_CREATED,
        entityType: AUDIT_ENTITY_TYPE.role,
        entityId: role.roleId,
        changes: { name: { to: role.name }, permissionKeys: { to: [...role.permissionKeys] } },
      });
    });
    return toRoleView(role, resolver);
  }
}

import { asId, type OrganizationId, type RoleId } from "@banijjik/ids";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type {
  RoleManagementRepository,
  RolePage,
  RolePageRequest,
} from "../application/ports/role-management-repository.js";
import type { RoleRepository } from "../application/ports/role-repository.js";
import type { Role } from "../domain/role.entity.js";
import { toDuplicateRoleNameError } from "./duplicate-role-name.js";
import { toRole, toRoleDocument } from "./role.mapper.js";
import { ROLE_MODEL_NAME, type RoleDocument } from "./role.schema.js";

type RoleKeyRow = Pick<RoleDocument, "roleId" | "roleKey">;

const LIST_SORT = { isSystem: -1, name: 1, roleId: 1 } as const;

/** Roles are tenant data: the tenant plugin adds the organization filter to every query (ADR-087). */
export class MongoRoleRepository implements RoleRepository, RoleManagementRepository {
  async insertMany(roles: readonly Role[]): Promise<void> {
    await this.model().create(roles.map(toRoleDocument), {
      ordered: true,
      ...sessionOption(getActiveSession()),
    });
  }

  async insert(role: Role): Promise<void> {
    try {
      await this.model().create([toRoleDocument(role)], sessionOption(getActiveSession()));
    } catch (error) {
      throw toDuplicateRoleNameError(error);
    }
  }

  async findRoleKeysByIds(
    organizationIds: readonly OrganizationId[],
    roleIds: readonly RoleId[],
  ): Promise<ReadonlyMap<RoleId, string>> {
    const rows = await this.model()
      .find(
        { organizationId: { $in: organizationIds }, roleId: { $in: roleIds } },
        { roleId: 1, roleKey: 1, _id: 0 },
        sessionOption(getActiveSession()),
      )
      .lean<RoleKeyRow[]>();
    return new Map(rows.map((row) => [asId<RoleId>(row.roleId), row.roleKey]));
  }

  async findById(roleId: RoleId): Promise<Role | undefined> {
    const found = await this.findByIds([roleId]);
    return found[0];
  }

  async findByIds(roleIds: readonly RoleId[]): Promise<readonly Role[]> {
    if (roleIds.length === 0) return [];
    const documents = await this.model()
      .find({ roleId: { $in: roleIds } }, null, sessionOption(getActiveSession()))
      .lean<RoleDocument[]>();
    return documents.map(toRole);
  }

  async list(request: RolePageRequest): Promise<RolePage> {
    // One extra row tells whether another page exists, without counting the collection.
    const documents = await this.model()
      .find({}, null, sessionOption(getActiveSession()))
      .sort(LIST_SORT)
      .skip((request.page - 1) * request.limit)
      .limit(request.limit + 1)
      .lean<RoleDocument[]>();
    return {
      roles: documents.slice(0, request.limit).map(toRole),
      hasNext: documents.length > request.limit,
    };
  }

  async update(role: Role, expectedVersion: number): Promise<Role> {
    try {
      const saved = await updateVersioned<RoleDocument>({
        model: this.model(),
        // System roles are never updatable, whatever the caller passes.
        filter: { roleId: role.roleId, isSystem: false },
        expectedVersion,
        update: {
          $set: {
            name: role.name,
            permissionKeys: [...role.permissionKeys],
            status: role.status,
            updatedByUserId: role.updatedByUserId,
          },
        },
      });
      return toRole(saved);
    } catch (error) {
      throw toDuplicateRoleNameError(error);
    }
  }

  private model() {
    return models({}).get<RoleDocument>(ROLE_MODEL_NAME);
  }
}

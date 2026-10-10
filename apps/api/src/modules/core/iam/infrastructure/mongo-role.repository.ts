import { asId, type OrganizationId, type RoleId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { RoleRepository } from "../application/ports/role-repository.js";
import type { Role } from "../domain/role.entity.js";
import { toRoleDocument } from "./role.mapper.js";
import { ROLE_MODEL_NAME, type RoleDocument } from "./role.schema.js";

type RoleKeyRow = Pick<RoleDocument, "roleId" | "roleKey">;

/** Roles are platform data with explicit `organizationId` filters until the tenant plugin arrives (card 1.3). */
export class MongoRoleRepository implements RoleRepository {
  async insertMany(roles: readonly Role[]): Promise<void> {
    await this.model().create(roles.map(toRoleDocument), {
      ordered: true,
      ...sessionOption(getActiveSession()),
    });
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

  private model() {
    return models({}).get<RoleDocument>(ROLE_MODEL_NAME);
  }
}

import { MEMBER_STATUS } from "@banijjik/contracts";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { MemberAccessReader, MemberAssignment } from "../../iam/index.js";
import { MEMBER_MODEL_NAME, type MemberDocument } from "./member.schema.js";

interface RoleCountRow {
  _id: string;
  memberCount: number;
}

/** Members of the active organization for iam's role checks; the tenant plugin scopes every query. */
export class MongoMemberAccessReader implements MemberAccessReader {
  async findAssignments(memberId: string): Promise<readonly MemberAssignment[]> {
    const member = await this.model()
      .findOne({ memberId }, { assignments: 1, _id: 0 }, sessionOption(getActiveSession()))
      .lean<Pick<MemberDocument, "assignments">>();
    if (member === null) return [];
    return member.assignments.map(({ locationId, roleId }) => ({ locationId, roleId }));
  }

  async countActiveMembersByRole(roleIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    if (roleIds.length === 0) return new Map();
    // One aggregate for all roles. A member holding a role at several locations counts once.
    const rows = await this.model()
      .aggregate<RoleCountRow>([
        { $match: { status: MEMBER_STATUS.ACTIVE, "assignments.roleId": { $in: roleIds } } },
        { $unwind: "$assignments" },
        { $match: { "assignments.roleId": { $in: roleIds } } },
        { $group: { _id: "$assignments.roleId", memberIds: { $addToSet: "$memberId" } } },
        { $project: { memberCount: { $size: "$memberIds" } } },
      ])
      .session(getActiveSession() ?? null);
    return new Map(rows.map((row) => [row._id, row.memberCount]));
  }

  private model() {
    return models({}).get<MemberDocument>(MEMBER_MODEL_NAME);
  }
}

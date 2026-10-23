import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { MemberNameReader } from "../application/ports/member-name-reader.js";
import { MEMBER_MODEL_NAME, type MemberDocument } from "./member.schema.js";

/** One indexed query for any number of members; the tenant plugin scopes it to the active organization. */
export class MongoMemberNameReader implements MemberNameReader {
  async readNames(memberIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    if (memberIds.length === 0) return new Map();
    const rows = await models({})
      .get<MemberDocument>(MEMBER_MODEL_NAME)
      .find(
        { memberId: { $in: [...memberIds] } },
        { memberId: 1, displayName: 1, _id: 0 },
        sessionOption(getActiveSession()),
      )
      .lean<Pick<MemberDocument, "memberId" | "displayName">[]>();
    return new Map(rows.map((row) => [row.memberId, row.displayName]));
  }
}

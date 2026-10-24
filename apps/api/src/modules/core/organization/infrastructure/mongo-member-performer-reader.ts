import { ALL_LOCATIONS, MEMBER_STATUS } from "@banijjik/contracts";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { MemberPerformerReader } from "../application/ports/member-performer-reader.js";
import { MEMBER_MODEL_NAME, type MemberDocument } from "./member.schema.js";

type PerformerRow = Pick<MemberDocument, "memberId" | "displayName">;

/** The filter every performer read shares: ACTIVE, and assigned at the location or at ALL. */
function assignableFilter(locationId: string) {
  return {
    status: MEMBER_STATUS.ACTIVE,
    assignments: { $elemMatch: { locationId: { $in: [locationId, ALL_LOCATIONS] } } },
  };
}

/** Indexed by `{ organizationId, status, assignments.locationId }`; the tenant plugin scopes it. */
export class MongoMemberPerformerReader implements MemberPerformerReader {
  async filterAssignable(
    locationId: string,
    memberIds: readonly string[],
  ): Promise<ReadonlySet<string>> {
    if (memberIds.length === 0) return new Set();
    const rows = await this.model()
      .find(
        { ...assignableFilter(locationId), memberId: { $in: [...memberIds] } },
        { memberId: 1, _id: 0 },
        sessionOption(getActiveSession()),
      )
      .lean<Pick<PerformerRow, "memberId">[]>();
    return new Set(rows.map((row) => row.memberId));
  }

  async listAt(
    locationId: string,
    limit: number,
  ): Promise<readonly { readonly memberId: string; readonly name: string }[]> {
    const rows = await this.model()
      .find(
        assignableFilter(locationId),
        { memberId: 1, displayName: 1, _id: 0 },
        sessionOption(getActiveSession()),
      )
      .sort({ displayName: 1, memberId: 1 })
      .limit(limit)
      .lean<PerformerRow[]>();
    return rows.map((row) => ({ memberId: row.memberId, name: row.displayName }));
  }

  private model() {
    return models({}).get<MemberDocument>(MEMBER_MODEL_NAME);
  }
}

import { MEMBER_STATUS } from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { MemberRepository } from "../application/ports/repositories.js";
import type { Member } from "../domain/member.entity.js";
import { toMember, toMemberDocument } from "./member.mapper.js";
import { MEMBER_MODEL_NAME, type MemberDocument } from "./member.schema.js";

/**
 * A platform model. `findActiveByUserId` deliberately spans organizations (ADR-022); until the
 * tenant plugin exists (card 1.3) every other query would filter by `organizationId` explicitly.
 */
export class MongoMemberRepository implements MemberRepository {
  async insert(member: Member): Promise<void> {
    await this.model().create([toMemberDocument(member)], sessionOption(getActiveSession()));
  }

  async findActiveByUserId(userId: UserId, limit: number): Promise<Member[]> {
    const documents = await this.model()
      .find({ userId, status: MEMBER_STATUS.ACTIVE }, null, sessionOption(getActiveSession()))
      .limit(limit)
      .lean<MemberDocument[]>();
    return documents.map(toMember);
  }

  private model() {
    return models({}).get<MemberDocument>(MEMBER_MODEL_NAME);
  }
}

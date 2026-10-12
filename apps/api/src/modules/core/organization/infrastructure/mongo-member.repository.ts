import { MEMBER_STATUS } from "@banijjik/contracts";
import type { LocationId, MemberId, UserId } from "@banijjik/ids";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type {
  MemberListRequest,
  MemberManagementRepository,
} from "../application/ports/member-and-invitation-repositories.js";
import type { Page } from "../application/ports/profile-and-location-repositories.js";
import type { MemberRepository } from "../application/ports/repositories.js";
import type { Member } from "../domain/member.entity.js";
import { assignmentsReachFilter } from "./assignments-reach-filter.js";
import { toDuplicateFieldError } from "./duplicate-field.js";
import { toAssignmentDocument, toMember, toMemberDocument } from "./member.mapper.js";
import { MEMBER_MODEL_NAME, type MemberDocument } from "./member.schema.js";

const LIST_SORT = { displayName: 1, memberId: 1 } as const;

function escapeRegularExpression(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A tenant model: inside a request or an organization context the plugin adds the organization
 * filter. `findActiveByUserId` deliberately spans organizations (ADR-022); routes/v1.ts wraps
 * it as system access.
 */
export class MongoMemberRepository implements MemberRepository, MemberManagementRepository {
  async insert(member: Member): Promise<void> {
    try {
      await this.model().create([toMemberDocument(member)], sessionOption(getActiveSession()));
    } catch (error) {
      throw toDuplicateFieldError(error, "userId");
    }
  }

  async findActiveByUserId(userId: UserId, limit: number): Promise<Member[]> {
    const documents = await this.model()
      .find({ userId, status: MEMBER_STATUS.ACTIVE }, null, sessionOption(getActiveSession()))
      .limit(limit)
      .lean<MemberDocument[]>();
    return documents.map(toMember);
  }

  async findById(memberId: MemberId): Promise<Member | undefined> {
    return this.findOneBy({ memberId });
  }

  async findByUserId(userId: UserId): Promise<Member | undefined> {
    return this.findOneBy({ userId });
  }

  async list(request: MemberListRequest): Promise<Page<Member>> {
    const { status, search, page, limit, reach } = request;
    const filter = {
      ...(status === undefined ? {} : { status }),
      ...(search === undefined
        ? {}
        : { displayName: { $regex: escapeRegularExpression(search), $options: "i" } }),
      ...assignmentsReachFilter(reach),
    };
    // One extra row tells whether another page exists, without counting the collection.
    const documents = await this.model()
      .find(filter, null, sessionOption(getActiveSession()))
      .sort(LIST_SORT)
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .lean<MemberDocument[]>();
    return { items: documents.slice(0, limit).map(toMember), hasNext: documents.length > limit };
  }

  countActive(): Promise<number> {
    return this.model()
      .countDocuments({ status: MEMBER_STATUS.ACTIVE })
      .session(getActiveSession() ?? null)
      .exec();
  }

  async existsActiveAssignedTo(locationId: LocationId): Promise<boolean> {
    const found = await this.model()
      .exists({ status: MEMBER_STATUS.ACTIVE, "assignments.locationId": locationId })
      .session(getActiveSession() ?? null);
    return found !== null;
  }

  async update(member: Member, expectedVersion: number, actorUserId: UserId): Promise<Member> {
    const saved = await updateVersioned<MemberDocument>({
      model: this.model(),
      filter: { memberId: member.memberId },
      expectedVersion,
      update: {
        $set: {
          status: member.status,
          displayName: member.displayName,
          assignments: member.assignments.map(toAssignmentDocument),
          joinedAt: member.joinedAt,
          updatedByUserId: actorUserId,
          ...(member.jobTitle === undefined ? {} : { jobTitle: member.jobTitle }),
        },
      },
    });
    return toMember(saved);
  }

  private async findOneBy(filter: object): Promise<Member | undefined> {
    const document = await this.model()
      .findOne(filter, null, sessionOption(getActiveSession()))
      .lean<MemberDocument>();
    return document === null ? undefined : toMember(document);
  }

  private model() {
    return models({}).get<MemberDocument>(MEMBER_MODEL_NAME);
  }
}
